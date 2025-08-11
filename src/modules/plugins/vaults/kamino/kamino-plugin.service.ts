import { VaultPluginAbstract } from "../abstract"
import { Inject, Injectable } from "@nestjs/common"
import { ChainKey, Network, StrategyResult, TokenType } from "@/modules/common"
import { TokenData, TokenId, tokens } from "@/modules/blockchain"
import { KaminoVaultCacheService, Vault } from "./kamino-cache.service"
import { address } from "@solana/kit"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { ExecuteParams } from "../../types"
import { randomUUID } from "crypto"

export interface KaminoVault {
  // vault id
  id: string;
  // apr
  apr: number;
  // share mint
  shareMint: string;
  // share price
  sharePrice: number;
}

@Injectable()
export class KaminoVaultPluginService extends VaultPluginAbstract {
    constructor(
    private readonly kaminoVaultCacheService: KaminoVaultCacheService,
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
        const cacheKey = this.kaminoVaultCacheService.getVaultCacheKey(
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
                        n\
                    },
                ],
            },
            yieldSummary: {
        }
    }

    public async execute(params: ExecuteParams): Promise<StrategyResult> {
        const result: StrategyResult = {
            strategies: [],
        }
        const promises: Array<Promise<void>> = []
        for (const inputToken of params.inputTokens) {
            promises.push(
                (async () => {
                    const singleResult = await this.executeSingle({
                        ...params,
                        inputToken,
                    })
                    if (singleResult) {
                        result.strategies.push(...singleResult.strategies)
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
  // disable cache, if not provided, use the default disable cache
  disableCache?: boolean;
}
