import { VaultPluginAbstract } from "../abstract"
import { Inject, Injectable } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import {
    InterestRateConverterService,
    TokenData,
    TokenId,
    tokens,
} from "@/modules/blockchain"
import {
    KaminoVaultFetchService,
    Vault,
    VaultRawsData,
} from "./kamino-fetch.service"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { ExecuteParams } from "../../types"
import { randomUUID } from "crypto"
import { Decimal } from "decimal.js"
@Injectable()
export class KaminoVaultPluginService extends VaultPluginAbstract {
    constructor(
    private readonly kaminoVaultFetchService: KaminoVaultFetchService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly interestRateConverterService: InterestRateConverterService,
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
        const vaultRaws = await this.cacheManager.get<VaultRawsData>(
            this.kaminoVaultFetchService.getVaultsCacheKey(params.network),
        )
        if (!vaultRaws) {
            return []
        }
        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const vaultRaw of vaultRaws.vaults) {
            promises.push(
                (async () => {
                    if (!vaultRaw.address) {
                        return
                    }
                    const vault = await this.cacheManager.get<Vault>(
                        this.kaminoVaultFetchService.getVaultCacheKey(
                            params.network,
                            vaultRaw.address,
                        ),
                    )
                    if (!vault) {
                        return
                    }
                    results.push({
                        id: randomUUID(),
                        outputTokens: {
                            tokens: [
                                {
                                    id: randomUUID(),
                                    address: vault.address,
                                    priceInUSD: Number(vault.metrics.sharePrice),
                                },
                            ],
                        },
                        yieldSummary: {
                            aprs: {
                                base: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vault.metrics.apy),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                day: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vault.metrics.apy24h),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                week: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vault.metrics.apy7d),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                month: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vault.metrics.apy30d),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                                year: this.interestRateConverterService
                                    .toAPR(
                                        new Decimal(vault.metrics.apy365d),
                                        params.chainKey,
                                        params.network,
                                    )
                                    .toNumber(),
                            },
                            apys: {
                                base: Number(vault.metrics.apy),
                                day: Number(vault.metrics.apy24h),
                                week: Number(vault.metrics.apy7d),
                                month: Number(vault.metrics.apy30d),
                                year: Number(vault.metrics.apy365d),
                            },
                            tvl: vault.metricsHistory[vault.metricsHistory.length - 1]?.tvl
                                ? Number(
                                    vault.metricsHistory[vault.metricsHistory.length - 1].tvl,
                                )
                                : undefined,
                        },
                        metadata: {
                            vaultId: vault.address,
                            url: `https://app.kamino.finance/earn/lend/${vault.address}`,
                        },
                        strategyAnalysis: vault.strategyAnalysis,
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
