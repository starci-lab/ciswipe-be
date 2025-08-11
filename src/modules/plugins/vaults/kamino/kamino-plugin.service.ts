import { VaultPluginAbstract } from "../abstract"
import { Inject, Injectable } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import { TokenData, TokenId, tokens } from "@/modules/blockchain"
import { KaminoVaultFetchService, Vault } from "./kamino-fetch.service"
import { address } from "@solana/kit"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { ExecuteParams } from "../../types"
import { randomUUID } from "crypto"
import { calculateAPRFromAPY } from "@kamino-finance/klend-sdk"

@Injectable()
export class KaminoVaultPluginService extends VaultPluginAbstract {
    constructor(
        private readonly kaminoVaultFetchService: KaminoVaultFetchService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
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
    ): Promise<StrategyResult | null> {
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
        // load from cache
        const cacheKey = this.kaminoVaultFetchService.getVaultCacheKey(
            params.network,
            address(token.tokenAddress),
        )
        const vault = await this.cacheManager.get<Vault>(cacheKey)
        if (!vault) {
            return null
        }
        
        return {
            id: randomUUID(),
            outputTokens: {
                tokens: [
                    {
                        id: randomUUID(),
                        address: vault.state?.sharesMint,
                        priceInUSD: Number(vault.metrics.sharePrice),
                    },
                ],
            },
            metadata: {
                vaultId: vault.address,
                url: `https://app.kamino.finance/lend/${vault.address}`,
            },
            yieldSummary: {
                aprs: {
                    base: calculateAPRFromAPY(Number(vault.metrics.apy)).toNumber(),
                    day: calculateAPRFromAPY(Number(vault.metrics.apy24h)).toNumber(),
                    week: calculateAPRFromAPY(Number(vault.metrics.apy7d)).toNumber(),
                    month: calculateAPRFromAPY(Number(vault.metrics.apy30d)).toNumber(),
                    year: calculateAPRFromAPY(Number(vault.metrics.apy365d)).toNumber(),
                },
                apys: {
                    base: Number(vault.metrics.apy),
                    day: Number(vault.metrics.apy24h),
                    week: Number(vault.metrics.apy7d),
                    month: Number(vault.metrics.apy30d),
                    year: Number(vault.metrics.apy365d),
                },
            },
            aiAnalysis: vault.aiAnalysis,
        }
    }

    public async execute(params: ExecuteParams): Promise<Array<StrategyResult>> {
        const result: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const inputToken of params.inputTokens) {
            promises.push(
                (async () => {
                    const singleResult = await this.executeSingle({
                        ...params,
                        inputToken,
                    })
                    if (singleResult) {
                        result.push(singleResult)
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
