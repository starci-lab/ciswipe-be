import {
    ChainKey,
    createProviderToken,
    Network,
    OutputStrategy,
    OutputStrategyAprDuration,
    OutputStrategyType,
    RecordRpcProvider,
    TokenId,
    tokens,
    TokenType,
} from "@/modules/blockchain"
import {
    AddLiquidityV3OutputResult,
    AddLiquidityV3Params,
    DexPluginAbstract,
} from "../abstract"
import { Raydium } from "@raydium-io/raydium-sdk-v2"
import {
    Inject,
    Injectable,
    OnApplicationBootstrap,
    OnModuleInit,
} from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { createCacheKey } from "@/modules/cache"

@Injectable()
export class RaydiumPlugin
    extends DexPluginAbstract
    implements OnModuleInit, OnApplicationBootstrap
{
    private raydiums: Record<Network, Raydium>
    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
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

    async onApplicationBootstrap() {
        const output = await this.addLiquidityV3({
            network: Network.Mainnet,
            chainKey: ChainKey.Solana,
            inputTokens: [
                {
                    TokenId: TokenId.SolanaSolMainnet,
                },
                {
                    TokenId: TokenId.SolanaUsdcMainnet,
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
    protected async addLiquidityV3({
        dump,
        ...coreParams
    }: AddLiquidityV3Params): Promise<AddLiquidityV3OutputResult> {
    // raydium support only for Solana so that we dont care about chainKey
        if (coreParams.inputTokens.length !== 2) {
            throw new Error("Raydium add liquidity v3 only supports 2 input tokens")
        }
        if (dump) {
            console.log("addLiquidityV3", coreParams)
        }
        // get the pool info
        const [token1, token2] = coreParams.inputTokens
        // if token1 = token2, throw error
        if (token1.TokenId === token2.TokenId) {
            throw new Error(
                "Raydium add liquidity v3 only supports 2 different input tokens",
            )
        }
        let [token1Entity, token2Entity] = tokens[ChainKey.Solana][
            coreParams.network
        ].filter(
            (token) => token.id === token1.TokenId || token.id === token2.TokenId,
        )
        // if token1 or token2 = sol, we change to wsol
        if (token1Entity.type === TokenType.Native) {
            const wrapper = tokens[ChainKey.Solana][coreParams.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
            token1Entity = wrapper
        }
        if (token2Entity.type === TokenType.Native) {
            const wrapper = tokens[ChainKey.Solana][coreParams.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
            token2Entity = wrapper
        }
        if (!token1Entity.tokenAddress || !token2Entity.tokenAddress) {
            throw new Error("Raydium token address not found")
        }
        const cacheKey = createCacheKey(coreParams)
        if (!coreParams.disableCache) {
            const outputResult =
        await this.cacheManager.get<AddLiquidityV3OutputResult>(cacheKey)
            if (outputResult) {
                return outputResult
            }
        }
        const poolsApiReturn = await this.raydiums[
            coreParams.network
        ].api.fetchPoolByMints({
            mint1: token1Entity.tokenAddress,
            mint2: token2Entity.tokenAddress,
        })
        // write to file
        const strategies: Array<OutputStrategy> = poolsApiReturn.data
            .filter((pool) => pool.type === "Concentrated")
            .sort((poolPrev, poolNext) => poolPrev.tvl - poolNext.tvl)
            .map((pool) => {
                const rewardTokenAddresses = pool.rewardDefaultInfos.map(
                    (info) => info.mint.address,
                )
                const rewardTokenIds = rewardTokenAddresses.map((address) => {
                    const token = tokens[ChainKey.Solana][coreParams.network].find(
                        (token) => token.tokenAddress === address,
                    )
                    if (!token) {
                        throw new Error("Raydium reward token not found")
                    }
                    return token.id
                })
                return {
                    aprs: {
                        [OutputStrategyAprDuration.Day]: {
                            apr: pool.day.apr,
                            feeApr: pool.day.feeApr,
                            rewards: pool.day.rewardApr.map((rewardApr, index) => ({
                                apr: rewardApr,
                                tokenId: rewardTokenIds[index],
                            })),
                        },
                        [OutputStrategyAprDuration.Week]: {
                            apr: pool.week.apr,
                            feeApr: pool.week.feeApr,
                            rewards: pool.week.rewardApr.map((rewardApr, index) => ({
                                apr: rewardApr,
                                tokenId: rewardTokenIds[index],
                            })),
                        },
                        [OutputStrategyAprDuration.Month]: {
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
                    type: OutputStrategyType.AddLiquidityV3,
                }
            })
        if (!coreParams.disableCache) {
            await this.cacheManager.set<AddLiquidityV3OutputResult>(cacheKey, {
                strategies,
            })
        }
        return {
            strategies,
        }
    }
}
