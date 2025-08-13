import { LendingPluginAbstract } from "../abstract"
import { Inject, Injectable } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import { InterestRateConverterService, TokenId, tokens } from "@/modules/blockchain"
import { LendingVaultsData, MarketExtends, SolendLendingFetchService } from "./solend-fetch.service"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { ExecuteParams } from "../../types"
import { randomUUID } from "crypto"
import { ExecuteSingleParams } from "./types"
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
            description: "Solend is a decentralized lending and borrowing protocol on Solana, allowing users to earn interest on deposits or borrow assets seamlessly.",
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
        const marketsData = await this.cacheManager.get<MarketExtends>(this.solendFetchService.getMarketsCacheKey(params.network))
        if (!marketsData) {
            return []
        }
        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const market of marketsData.markets) {
            promises.push(
                (async () => {
                    if (!market.address) {
                        return
                    }
                    const vaults = await this.cacheManager.get<LendingVaultsData>(
                        this.solendFetchService.getLendingVaultsCacheKey(
                            params.network,
                            market.address
                        )
                    )
                    if (!vaults) {
                        return
                    }
                    for (const vault of vaults.lendingVaults) {
                        if (vault.reserve.config.liquidityAddress === token.tokenAddress) {
                            results.push({
                                id: randomUUID(),
                                outputTokens: {
                                    tokens: [
                                        {
                                            id: randomUUID(),
                                            address: vault.reserve.stats?.mintAddress,
                                            priceInUSD: vault.reserve.stats?.assetPriceUSD,
                                            type: TokenType.Regular,
                                        }
                                    ],
                                },
                                yieldSummary: {
                                    aprs: {
                                        base: this.interestRateConverterService.toAPR(
                                            new Decimal(vault.reserve.totalSupplyAPY.totalAPY),
                                            params.chainKey,
                                            params.network
                                        ).toNumber(),
                                    },
                                    apys: {
                                        base: this.interestRateConverterService.toAPY(
                                            new Decimal(vault.reserve.totalSupplyAPY.totalAPY),
                                            params.chainKey,
                                            params.network
                                        ).toNumber(),
                                    }
                                },
                                metadata: {
                                    vaultId: vault.address,
                                    market: market
                                },
                                strategyAnalysis: vault.strategyAnalysis,
                            })
                        }
                    }
                })(),
            )
        }
        await Promise.all(promises)
        return results
    }

    public async execute(
        params: ExecuteParams
    ): Promise<Array<StrategyResult>> {
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