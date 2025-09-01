import {
    TokenUtilsService,
} from "@/modules/blockchain"
import { DexPluginAbstract, V3ExecuteParams } from "../abstract"
import { Injectable } from "@nestjs/common"
import {
    ChainKey,
    Network,
    combinations,
    StrategyResult,
    TokenType,
} from "@/modules/common"
import { TokenData, tokens } from "@/modules/blockchain"
import { OrcaDexCacheService } from "./orca-cache.service"
import { CacheHelpersService, createCacheKey, CacheType } from "@/modules/cache"
import { v4 } from "uuid"

export interface V3ExecuteSingleParams {
  network: Network;
  chainKey: ChainKey;
  inputTokens: Array<TokenData>;
}

@Injectable()
export class OrcaDexPluginService
    extends DexPluginAbstract
{
    constructor(
    private readonly cacheHelpersService: CacheHelpersService,
    private readonly orcaDexCacheService: OrcaDexCacheService,
    private readonly tokenUtilsService: TokenUtilsService,
    ) {
        super({
            name: "Orca",
            icon: "https://www.orca.so/favicon.ico",
            url: "https://www.orca.so",
            description:
              "Orca is one of the first and most user-friendly decentralized exchanges on Solana, offering concentrated liquidity pools (Whirlpools) with efficient trading and yield opportunities.",
            tags: ["dex", "amm", "liquidity"],
            chainKeys: [ChainKey.Solana],
        })
    }

    private async v3ExecuteSingle({
        network,
        chainKey,
        inputTokens,
    }: V3ExecuteSingleParams): Promise<Array<StrategyResult>> {
        if (inputTokens.length !== 2) {
            throw new Error("Raydium add liquidity v3 only supports 2 input tokens")
        }
        // get the pool info
        const [token1, token2] = inputTokens
        if (token1.id === token2.id) {
            throw new Error(
                "Raydium add liquidity v3 only supports 2 different input tokens",
            )
        }
        // get the token info
        const token1Entity = tokens[chainKey][network].find(
            (token) => token.id === token1.id,
        )
        const token2Entity = tokens[chainKey][network].find(
            (token) => token.id === token2.id,
        )
        if (!token1Entity || !token2Entity) {
            throw new Error("Raydium token not found")
        }
        if (token1Entity.type === TokenType.Native) {
            const wrapper = tokens[chainKey][network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
        }
        if (token2Entity.type === TokenType.Native) {
            const wrapper = tokens[chainKey][network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
        }
        const index = this.tokenUtilsService.getIndexByPair({
            token0: token1Entity.id,
            token1: token2Entity.id,
            chainKey,
            network,
        })
        const poolBatch = await this.orcaDexCacheService.getPoolBatch(
            network,
            index,
        )
        if (!poolBatch) {
            throw new Error("Raydium pool batch not found")
        }

        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const pool of poolBatch.pools.map((pool) => pool.pool)) {
            promises.push(
                (async () => {
                    results.push({
                        outputTokens: {
                            tokens: [],
                        },
                        metadata: {
                            poolId: pool.address,
                            feeRate: pool.feeRate,
                            tvl: pool.tvlUsdc,
                            lockedLiquidityPercent: pool.lockedLiquidityPercent,
                        },
                        rewards: {
                            rewardTokens: pool.rewards?.map((info) => ({
                                token: {
                                    id: v4(),
                                    address: info.mint
                                },
                            })),
                        },
                        yieldSummary: {},
                    })
                })(),
            )
        }
        await Promise.all(promises)
        return results
    }

    // method to add liquidity to a pool
    protected async v3Execute(
        params: V3ExecuteParams,
    ): Promise<Array<StrategyResult>> {
        return await this.cacheHelpersService.getOrSetCache({
            key: createCacheKey("raydium-dex-v3-execute", params),
            action: async () => {
                const { network, chainKey, inputTokens } = params
                const tokenPairs = combinations(inputTokens, 2)
                const results: Array<StrategyResult> = []
                const promises: Array<Promise<void>> = []
                for (const tokenPair of tokenPairs) {
                    promises.push(
                        (async () => {
                            const results = await this.v3ExecuteSingle({
                                network,
                                chainKey,
                                inputTokens: tokenPair,
                            })
                            results.push(...results)
                        })(),
                    )
                }
                await Promise.all(promises)
                return results
            },
            type: CacheType.Redis,
        })
    }
}
