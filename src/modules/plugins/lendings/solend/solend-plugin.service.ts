import { LendingPluginAbstract } from "../abstract"
import { Inject, Injectable } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import {
    InterestRateConverterService,
    TokenId,
    tokens,
} from "@/modules/blockchain"
import {
    LendingReserveMetadata,
    PoolsData,
    SolendLendingFetchService,
} from "./solend-fetch.service"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { ExecuteParams } from "../../types"
import { ExecuteSingleParams } from "./types"
import { randomUUID } from "crypto"
import { Decimal } from "decimal.js"

@Injectable()
export class SolendLendingPluginService extends LendingPluginAbstract {
    constructor(
    private readonly solendFetchService: SolendLendingFetchService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly interestRateConverterService: InterestRateConverterService,
    ) {
        super({
            name: "Solend",
            icon: "https://solend.fi/icons/favicon.ico",
            url: "https://solend.fi",
            description:
        "Solend is a decentralized lending and borrowing protocol on Solana, allowing users to earn interest on deposits or borrow assets seamlessly.",
            tags: ["lending", "borrowing", "DeFi"],
            chainKeys: [ChainKey.Solana],
        })
    }

    public getChainKeys(): Array<ChainKey> {
        return [ChainKey.Solana]
    }

    public getTokenIds(): Record<Network, Array<TokenId>> {
        return {
            [Network.Mainnet]: [TokenId.SolanaUsdcMainnet, TokenId.SolanaSolMainnet],
            [Network.Testnet]: [],
        }
    }

    // method to execute the plugin
    public async executeSingle(
        params: ExecuteSingleParams,
    ): Promise<Array<StrategyResult>> {
        let token = tokens[params.chainKey][params.network].find(
            (token) => token.id === params.inputToken.id,
        )
        if (!token) {
            throw new Error("Token not found")
        }
        if (token.type === TokenType.Native) {
            token = tokens[params.chainKey][params.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!token) {
                throw new Error("Wrapper token not found")
            }
        }
        if (!token.tokenAddress) {
            throw new Error("Token address not found")
        }
        const marketsData = await this.cacheManager.get<PoolsData>(
            this.solendFetchService.getLendingPoolsCacheKey(params.network),
        )
        if (!marketsData) {
            return []
        }
        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const pool of marketsData.pools) {
            promises.push(
                (async () => {
                    const internalPromises: Array<Promise<void>> = []
                    for (const reserve of pool.reserves) {
                        internalPromises.push(
                            (async () => {
                                const metadata =
                  await this.cacheManager.get<LendingReserveMetadata>(
                      this.solendFetchService.getReserveMetadataCacheKey(
                          params.network,
                          reserve.reserve.address,
                      ),
                  )
                                if (!metadata) {
                                    return
                                }
                                if (
                                    reserve.reserve.data.liquidity.mintPubkey.toBase58() ===
                  token.tokenAddress
                                ) {
                                    results.push({
                                        id: randomUUID(),
                                        outputTokens: {
                                            tokens: [
                                                {
                                                    id: randomUUID(),
                                                    address:
                            reserve.reserve.data.collateral.mintPubkey.toBase58(),
                                                    type: TokenType.Regular,
                                                },
                                            ],
                                        },
                                        yieldSummary: {
                                            aprs: {
                                                base: this.interestRateConverterService
                                                    .toAPR(
                                                        new Decimal(reserve.reserve.supplyAPR),
                                                        params.chainKey,
                                                        params.network,
                                                    )
                                                    .toNumber(),
                                            },
                                            apys: {
                                                base: this.interestRateConverterService
                                                    .toAPY(
                                                        new Decimal(reserve.reserve.supplyAPR),
                                                        params.chainKey,
                                                        params.network,
                                                    )
                                                    .toNumber(),
                                            },
                                        },
                                        metadata: {
                                            vaultId: reserve.reserve.address,
                                            market: pool.market,
                                        },
                                        strategyAnalysis: metadata.strategyAnalysis,
                                        rewards: reserve.rewards,
                                    })
                                }
                            })(),
                        )
                    }
                    await Promise.all(internalPromises)
                })(),
            )
        }
        await Promise.all(promises)
        return results
    }

    public async execute(params: ExecuteParams): Promise<Array<StrategyResult>> {
        const result: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const inputToken of params.inputTokens) {
            promises.push(
                (async () => {
                    const singleResults = await this.executeSingle({
                        ...params,
                        inputToken,
                    })
                    if (singleResults.length) {
                        result.push(...singleResults)
                    }
                })(),
            )
        }
        await Promise.all(promises)
        return result
    }
}
