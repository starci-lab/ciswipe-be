import { VaultPluginAbstract } from "../abstract"
import { Injectable } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import {
    InterestRateConverterService,
    TokenData,
    TokenId,
    tokens,
} from "@/modules/blockchain"
import { ExecuteParams } from "../../types"
import { randomUUID } from "crypto"
import { Decimal } from "decimal.js"
import { KaminoVaultCacheService } from "./kamino-cache.service"

@Injectable()
export class KaminoVaultPluginService extends VaultPluginAbstract {
    constructor(
    private readonly interestRateConverterService: InterestRateConverterService,
    private readonly kaminoVaultCacheService: KaminoVaultCacheService,
    ) {
        super({
            name: "Kamino",
            icon: "https://kamino.finance/favicon.ico",
            url: "https://kamino.finance",
            description: "Kamino is a decentralized exchange on Solana.",
            tags: ["lending"],
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
        const vaultsData = await this.kaminoVaultCacheService.getVaultsData(params.network)
        if (!vaultsData) {
            return []
        }
        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const vault of vaultsData.vaults) {
            promises.push(
                (async () => {
                    if (!vault.address) {
                        return
                    }
                    const vaultMetadata = await this.kaminoVaultCacheService.getVaultMetadata(params.network, vault.address)
                    if (!vaultMetadata) {
                        return
                    }
                    results.push({
                        outputTokens: {
                            tokens: [
                                {
                                    id: randomUUID(),
                                    address: vaultMetadata.address,
                                    priceInUSD: Number(vaultMetadata.metrics.sharePrice),
                                },
                            ],
                        },
                        yieldSummary: {
                            aprs: {
                                base: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vaultMetadata.metrics.apy),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                day: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vaultMetadata.metrics.apy24h),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                week: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vaultMetadata.metrics.apy7d),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                month: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vaultMetadata.metrics.apy30d),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                year: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vaultMetadata.metrics.apy365d),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                            },
                            apys: {
                                base: Number(vaultMetadata.metrics.apy),
                                day: Number(vaultMetadata.metrics.apy24h),
                                week: Number(vaultMetadata.metrics.apy7d),
                                month: Number(vaultMetadata.metrics.apy30d),
                                year: Number(vaultMetadata.metrics.apy365d),
                            },
                            tvl: vaultMetadata.metricsHistory?.[-1]?.tvl
                                ? Number(
                                    vaultMetadata.metricsHistory?.[-1].tvl,
                                )
                                : undefined,
                        },
                        metadata: {
                            vaultId: vaultMetadata.address,
                            url: `https://app.kamino.finance/earn/lend/${vaultMetadata.address}`,
                        },
                        strategyAnalysis: vaultMetadata.strategyAnalysis,
                    })
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

export interface ExecuteSingleParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input token
  inputToken: TokenData;
}
