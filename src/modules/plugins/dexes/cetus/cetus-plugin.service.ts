import {
    ChainKey,
    Network,
    OutputStrategy,
    OutputStrategyApr,
    OutputStrategyAprDuration,
    OutputStrategyType,
    TokenId,
    tokens,
} from "@/modules/blockchain"
import {
    AddLiquidityV3OutputResult,
    AddLiquidityV3Params,
    DexPluginAbstract,
    GetDataParams,
} from "../abstract"
import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { CetusApiResponse, CetusSdkService, PoolData } from "./cetus-sdk.service"
import { computePercentage } from "@/modules/common"
import { VolumeService } from "@/modules/volume"

@Injectable()
export class CetusPluginService
    extends DexPluginAbstract
    implements OnApplicationBootstrap
{
    protected async getData(params: GetDataParams): Promise<CetusApiResponse> {
        const volumeName = `cetus-${params.token1.id}-${params.token2.id}.json`
        try {
            if (!params.token1.tokenAddress || !params.token2.tokenAddress) {
                throw new Error("Token address is required")
            }
            const data = await this.cetusSdkService.getPools({
                coinTypes: [
                    params.token1.tokenAddress,
                    params.token2.tokenAddress,
                ],
            })
            await this.volumeService.writeJsonToDataVolume<CetusApiResponse>(
                volumeName,
                data, 
            )
            return data
        } catch (error) {
            console.error(error)
            // if error happlen, we try to read from volume
            // to ensure high-availability in case the provider refused to serve
            try {
                return await this.volumeService.readJsonFromDataVolume<CetusApiResponse>(
                    volumeName,
                )
            } catch (error) {
                console.error(error)
            }
            throw error 
        }
    }

    constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly volumeService: VolumeService,
    private readonly cetusSdkService: CetusSdkService,
    ) {
        super({
            name: "Cetus",
            icon: "https://cetus.zone/favicon.ico",
            url: "https://cetus.zone",
            description: "Cetus is a decentralized exchange on Sui.",
            tags: ["dex"],
            chainKeys: [ChainKey.Sui],
        })
    }

    async onApplicationBootstrap() {
        const output = await this.addLiquidityV3({
            network: Network.Mainnet,
            chainKey: ChainKey.Sui,
            inputTokens: [
                {
                    id: TokenId.SuiSuiMainnet,
                },
                {
                    id: TokenId.SuiUsdcMainnet,
                },
            ],
            disableCache: false,
        })
        console.dir(output, { depth: null })
    }

    private getTokenIdByAddress(address: string): TokenId {
        const tokenId = tokens[ChainKey.Sui][Network.Mainnet].find(
            (token) => token.tokenAddress === address,
        )?.id
        if (!tokenId) {
            throw new Error(`Token not found with given address: ${address}`)
        }
        return tokenId
    }

    private caculateAprForSpecificDuration(
        pool: PoolData,
        duration: OutputStrategyAprDuration,
    ): OutputStrategyApr {
        const durationMap = {
            [OutputStrategyAprDuration.Day]: "24H",
            [OutputStrategyAprDuration.Week]: "7D",
            [OutputStrategyAprDuration.Month]: "30D",
        }
        const durationKey = durationMap[duration]
        const stats = pool.stats.find((stat) => stat.dateType === durationKey)
        if (!stats) {
            return {
                apr: 0,
                feeApr: 0,
                rewards: [],
            }
        }
        const feeApr = computePercentage(parseFloat(stats.apr), 1, 5)
        const rewardsApr = (pool.miningRewarders || [])
            .filter((rewarder) => rewarder.display !== false) // Only include displayed rewards
            .map((rewarder) => ({
                apr: computePercentage(parseFloat(rewarder.apr), 1, 5) || 0,
                tokenId: this.getTokenIdByAddress(rewarder.coinType),
            }))
            .filter((reward) => computePercentage(reward.apr, 1, 5) > 0) // Only include positive APRs
        const apr =
      feeApr + rewardsApr.reduce((sum, reward) => sum + reward.apr, 0)
        return {
            apr,
            feeApr,
            rewards: rewardsApr,
        }
    }

    private calculateApr(
        pool: PoolData,
    ): Partial<Record<OutputStrategyAprDuration, OutputStrategyApr>> {
        const dailyApr = this.caculateAprForSpecificDuration(
            pool,
            OutputStrategyAprDuration.Day,
        )
        const weeklyApr = this.caculateAprForSpecificDuration(
            pool,
            OutputStrategyAprDuration.Week,
        )
        const monthlyApr = this.caculateAprForSpecificDuration(
            pool,
            OutputStrategyAprDuration.Month,
        )
        return {
            [OutputStrategyAprDuration.Day]: dailyApr,
            [OutputStrategyAprDuration.Week]: weeklyApr,
            [OutputStrategyAprDuration.Month]: monthlyApr,
        }
    }

    protected async addLiquidityV3(params: AddLiquidityV3Params): Promise<AddLiquidityV3OutputResult> {
    // cetus only support for sui so we dont care about chainKey parameter
        if (params.inputTokens.length !== 2) {
            throw new Error("Cetus only support for 2 tokens")
        }
        const [token1, token2] = params.inputTokens
        const [token1Entity, token2Entity] = tokens[ChainKey.Sui][
            params.network
        ].filter((token) => token.id === token1.id || token.id === token2.id)
        if (!token1Entity?.tokenAddress || !token2Entity?.tokenAddress) {
            return {
                strategies: [],
            }
        }
        const poolsData = await this.getData({
            network: params.network,
            chainKey: ChainKey.Sui,
            token1: token1Entity,
            token2: token2Entity,
        })
        const strategies: Array<OutputStrategy> = await Promise.all(
            (poolsData.list ?? []).map((pool) => {
                const aprs = this.calculateApr(pool)
                return {
                    aprs,
                    metadata: {
                        poolId: pool.pool,
                        feeRate: pool.feeRate,
                        tvl: parseFloat(pool.tvl) || 0,
                    },
                    type: OutputStrategyType.AddLiquidityV3,
                }
            }),
        )
        return {
            strategies,
        }
    }
}
