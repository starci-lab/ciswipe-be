import { LendingPluginAbstract } from "../abstract"
import { Injectable, Logger } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import {
    InterestRateConverterService,
    TokenId,
    tokens,
} from "@/modules/blockchain"
import { ExecuteParams } from "../../types"
import { ExecuteSingleParams } from "./types"
import { randomUUID } from "crypto"
import { Decimal } from "decimal.js"
import { SolendLendingCacheService } from "./solend-cache.service"

@Injectable()
export class SolendLendingPluginService extends LendingPluginAbstract {
    private readonly logger = new Logger(SolendLendingPluginService.name)

    constructor(
        private readonly interestRateConverterService: InterestRateConverterService,
        private readonly solendLendingCacheService: SolendLendingCacheService,
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
        try {
            let token = tokens[params.chainKey][params.network].find(
                (token) => token.id === params.inputToken.id,
            )
            if (!token) {
                this.logger.warn(`Token not found for id: ${params.inputToken.id}`)
                return []
            }
            
            if (token.type === TokenType.Native) {
                token = tokens[params.chainKey][params.network].find(
                    (token) => token.type === TokenType.Wrapper,
                )
                if (!token) {
                    this.logger.warn("Wrapper token not found for native token")
                    return []
                }
            }
            
            if (!token.tokenAddress) {
                this.logger.warn("Token address not found")
                return []
            }

            const lendingPoolsData = await this.solendLendingCacheService.getLendingPoolsData(params.network)
            if (!lendingPoolsData || !lendingPoolsData.pools || lendingPoolsData.pools.length === 0) {
                this.logger.debug(`No lending pools data found for network: ${params.network}`)
                return []
            }

            const results: Array<StrategyResult> = []

            // Process all pools and reserves efficiently
            for (const pool of lendingPoolsData.pools) {
                for (const reserve of pool.reserves) {
                    try {
                        // Check if this reserve matches the input token
                        if (
                            reserve.reserve.data.liquidity.mintPubkey.toBase58() ===
                            token.tokenAddress
                        ) {
                            const metadata = await this.solendLendingCacheService.getLendingReserveMetadata(params.network, reserve.reserve.address)
                            if (!metadata) {
                                this.logger.debug(`No metadata found for reserve: ${reserve.reserve.address}`)
                                continue
                            }
                            const strategyResult: StrategyResult = {
                                outputTokens: {
                                    tokens: [
                                        {
                                            id: randomUUID(),
                                            address: reserve.reserve.data.collateral.mintPubkey.toBase58(),
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
                            }

                            results.push(strategyResult)
                        }
                    } catch (error) {
                        this.logger.error(
                            `Error processing reserve ${reserve.reserve.address}: ${error.message}`,
                            error.stack,
                        )
                        continue
                    }
                }
            }

            this.logger.debug(`Found ${results.length} strategies for token ${token.tokenAddress}`)
            return results

        } catch (error) {
            this.logger.error(
                `Error executing single strategy for token ${params.inputToken.id}: ${error.message}`,
                error.stack,
            )
            return []
        }
    }

    public async execute(params: ExecuteParams): Promise<Array<StrategyResult>> {
        try {
            const result: Array<StrategyResult> = []
            
            // Process all input tokens
            for (const inputToken of params.inputTokens) {
                try {
                    const singleResults = await this.executeSingle({
                        ...params,
                        inputToken,
                    })
                    
                    if (singleResults.length > 0) {
                        result.push(...singleResults)
                    }
                } catch (error) {
                    this.logger.error(
                        `Error processing input token ${inputToken.id}: ${error.message}`,
                        error.stack,
                    )
                    continue
                }
            }

            this.logger.debug(`Total strategies found: ${result.length}`)
            return result

        } catch (error) {
            this.logger.error(
                `Error executing strategies: ${error.message}`,
                error.stack,
            )
            return []
        }
    }
}
