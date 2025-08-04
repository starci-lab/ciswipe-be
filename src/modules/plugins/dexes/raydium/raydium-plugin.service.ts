import {
    ChainKey,
    createProviderToken,
    Network,
    RecordRpcProvider,
    TokenId,
    tokens,
    TokenType,
} from "@/modules/blockchain"
import {
    DexPluginAbstract,
    GetDataParams,
    V3ExecuteParams,
    V3ExecuteResult,
    V3StrategyAprDuration,
    V3Strategy,
    StrategyType,
} from "../abstract"
import { PoolsApiReturn, Raydium } from "@raydium-io/raydium-sdk-v2"
import {
    Inject,
    Injectable,
    OnApplicationBootstrap,
    OnModuleInit,
} from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { createCacheKey } from "@/modules/cache"
import { VolumeService } from "@/modules/volume"

@Injectable()
export class RaydiumPluginService
    extends DexPluginAbstract
    implements OnModuleInit, OnApplicationBootstrap
{
    private raydiums: Record<Network, Raydium>
    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly volumeService: VolumeService,
    ) {
        super({
            name: "Raydium",
            icon: "https://raydium.io/favicon.ico",
            url: "https://raydium.io",
            description: "Raydium is a decentralized exchange on Solana.",
            tags: ["dex"],
            chainKeys: [ChainKey.Solana],
        })
    }

    protected async getData({
        ...coreParams
    }: GetDataParams): Promise<PoolsApiReturn> {
        const volumeName = `raydium-${coreParams.token1.id}-${coreParams.token2.id}.json`
        try {
            if (!coreParams.token1.tokenAddress || !coreParams.token2.tokenAddress) {
                throw new Error("Token address is required")
            }
            const raydium = this.raydiums[coreParams.network]
            const pools = await raydium.api.fetchPoolByMints({
                mint1: coreParams.token1.tokenAddress,
                mint2: coreParams.token2.tokenAddress,
            })
            await this.volumeService.writeJsonToDataVolume<PoolsApiReturn>(
                volumeName,
                pools,
            )
            return pools
        } catch (error) {
            console.error(error)
            // if error happlen, we try to read from volume
            try {
                return await this.volumeService.readJsonFromDataVolume<PoolsApiReturn>(
                    volumeName,
                )
            } catch (error) {
                console.error(error)
            }
            throw error
        }
    }
    async onApplicationBootstrap() {
        const output = await this.v3Execute({
            network: Network.Mainnet,
            chainKey: ChainKey.Solana,
            inputTokens: [
                {
                    id: TokenId.SolanaSolMainnet,
                },
                {
                    id: TokenId.SolanaUsdcMainnet,
                },
            ],
            disableCache: false,
        })
        console.dir(output, { depth: null })
    }

    async onModuleInit() {
        const _raydiums: Partial<Record<Network, Raydium>> = {}
        for (const network of Object.values(Network)) {
            _raydiums[network] = await Raydium.load({
                connection: this.solanaRpcProvider[network],
            })
        }
        this.raydiums = _raydiums as Record<Network, Raydium>
    }

    // method to add liquidity to a pool
    protected async v3Execute(params: V3ExecuteParams): Promise<V3ExecuteResult> {
    // raydium support only for Solana so that we dont care about chainKey
        if (params.inputTokens.length !== 2) {
            throw new Error("Raydium add liquidity v3 only supports 2 input tokens")
        }
        // get the pool info
        const [token1, token2] = params.inputTokens
        // if token1 = token2, throw error
        if (token1.id === token2.id) {
            throw new Error(
                "Raydium add liquidity v3 only supports 2 different input tokens",
            )
        }
        let [token1Entity, token2Entity] = tokens[ChainKey.Solana][
            params.network
        ].filter(
            (token) => token.id === token1.id || token.id === token2.id,
        )
        // if token1 or token2 = sol, we change to wsol
        if (token1Entity.type === TokenType.Native) {
            const wrapper = tokens[ChainKey.Solana][params.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
            token1Entity = wrapper
        }
        if (token2Entity.type === TokenType.Native) {
            const wrapper = tokens[ChainKey.Solana][params.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
            token2Entity = wrapper
        }
        if (!token1Entity?.tokenAddress || !token2Entity?.tokenAddress) {
            return {
                strategies: [],
            }
        }
        const cacheKey = createCacheKey("Raydium", params)
        if (!params.disableCache) {
            const outputResult =
        await this.cacheManager.get<V3ExecuteResult>(cacheKey)
            if (outputResult) {
                return outputResult
            }
        }
        const poolsApiReturn = await this.getData({
            network: params.network,
            chainKey: ChainKey.Solana,
            token1: token1Entity,
            token2: token2Entity,
        })
        // write to file
        const strategies: Array<V3Strategy> = poolsApiReturn.data
            .filter((pool) => pool.type === "Concentrated")
            .sort((poolPrev, poolNext) => poolPrev.tvl - poolNext.tvl)
            .map((pool) => {
                const rewardTokenAddresses = pool.rewardDefaultInfos.map(
                    (info) => info.mint.address,
                )
                const rewardTokenIds = rewardTokenAddresses.map((address) => {
                    const token = tokens[ChainKey.Solana][params.network].find(
                        (token) => token.tokenAddress === address,
                    )
                    if (!token) {
                        throw new Error("Raydium reward token not found")
                    }
                    return token.id
                })
                return {
                    aprs: {
                        [V3StrategyAprDuration.Day]: {
                            apr: pool.day.apr,
                            feeApr: pool.day.feeApr,
                            rewards: pool.day.rewardApr.map((rewardApr, index) => ({
                                apr: rewardApr,
                                tokenId: rewardTokenIds[index],
                            })),
                        },
                        [V3StrategyAprDuration.Week]: {
                            apr: pool.week.apr,
                            feeApr: pool.week.feeApr,
                            rewards: pool.week.rewardApr.map((rewardApr, index) => ({
                                apr: rewardApr,
                                tokenId: rewardTokenIds[index],
                            })),
                        },
                        [V3StrategyAprDuration.Month]: {
                            apr: pool.month.apr,
                            feeApr: pool.month.feeApr,
                            rewards: pool.month.rewardApr.map((rewardApr, index) => ({
                                apr: rewardApr,
                                tokenId: rewardTokenIds[index],
                            })),
                        },
                    },
                    metadata: {
                        poolId: pool.id,
                        feeRate: pool.feeRate,
                        tvl: pool.tvl,
                    },
                    type: StrategyType.AddLiquidityV3,
                }
            })
        if (!params.disableCache) {
            await this.cacheManager.set<V3ExecuteResult>(cacheKey, {
                strategies,
            })
        }
        return {
            strategies,
        }
    }
}
