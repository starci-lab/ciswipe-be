import {
    createProviderToken,
    RecordRpcProvider,
} from "@/modules/blockchain"
import {
    GetDataParams,
    ExecuteResult,
    ExecuteStrategy,
    VaultPluginAbstract,
    ExecuteParams,
} from "../abstract"
import {
    Inject,
    Injectable,
    OnModuleInit,
} from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { VolumeService } from "@/modules/volume"
import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoVaultClient,
    calculateAPRFromAPY,
} from "@kamino-finance/klend-sdk"
import {
    DEFAULT_RPC_CONFIG,
    createSolanaRpcApi,
    SolanaRpcApi,
    createRpc,
    createDefaultRpcTransport,
    address,
} from "@solana/kit"
import { createCacheKey } from "@/modules/cache"
import { ChainKey, computePercentage, Network, TokenType } from "@/modules/common"
import { TokenData, TokenId, tokens } from "@/modules/blockchain"
import { KaminoApiService } from "./kamino-api.service"

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
export class KaminoVaultPluginService
    extends VaultPluginAbstract
    implements OnModuleInit
{
    private kaminoVaultClients: Record<Network, KaminoVaultClient>
    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly volumeService: VolumeService,
    private readonly kaminoApiService: KaminoApiService,
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
        return [
            ChainKey.Solana,
        ]
    }

    public getTokenIds(): Record<Network, Array<TokenId>> {
        return {
            [Network.Mainnet]: [
                TokenId.SolanaUsdcMainnet,
                TokenId.SolanaSolMainnet,
            ],
            [Network.Testnet]: [
            ],
        }
    }

    protected async getData(params: GetDataParams): Promise<unknown> {
        if (params.inputTokens.length !== 1) {
            throw new Error("Kamino plugin only supports one input token")
        }
        const [inputToken] = params.inputTokens
        const volumeName = `kamino-${inputToken.id}.json`
        try {
            const vaults: Array<KaminoVault> = []
            if (!inputToken.tokenAddress) {
                throw new Error("Input token address is required")
            }
            const fetchedVaults = await this.kaminoVaultClients[
                params.network
            ].getAllVaultsForToken(address(inputToken.tokenAddress))
            const promises: Array<Promise<void>> = []
            for (const fetchedVault of fetchedVaults) {
                promises.push(
                    (async () => {
                        if (!fetchedVault || !fetchedVault.state) {
                            return
                        }
                        const { apy, sharePrice } = await this.kaminoApiService.getVaultMetrics({
                            vaultPubkey: fetchedVault.address,
                        })
                        const apr = calculateAPRFromAPY(apy)
                        vaults.push({
                            id: fetchedVault.address,
                            apr: apr.toNumber(),
                            shareMint: fetchedVault.state?.sharesMint || "",
                            sharePrice: Number(sharePrice),
                        })
                          
                    })()
                )
            }
            await Promise.all(promises)
            await this.volumeService.writeJsonToDataVolume<Array<KaminoVault>>(
                volumeName,
                vaults,
            )
            return vaults
        } catch (error) {
            console.error(error)
            // if error happlen, we try to read from volume
            try {
                return await this.volumeService.readJsonFromDataVolume<
          Array<KaminoVault>
        >(volumeName)
            } catch (error) {
                console.error(error)
            }
            throw error
        }
    }

    async onModuleInit() {
        const _kaminoVaultClients: Partial<Record<Network, KaminoVaultClient>> = {}
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) {
                // do nothing for testnet
                continue
            }
            const slotDuration = await getMedianSlotDurationInMsFromLastEpochs()
            const api = createSolanaRpcApi<SolanaRpcApi>({
                ...DEFAULT_RPC_CONFIG,
                defaultCommitment: "confirmed",
            })
            _kaminoVaultClients[network] = new KaminoVaultClient(
                createRpc({
                    api,
                    transport: createDefaultRpcTransport({
                        url: this.solanaRpcProvider[network].rpcEndpoint,
                    }),
                }),
                slotDuration,
            )
        }
        this.kaminoVaultClients = _kaminoVaultClients as Record<
      Network,
      KaminoVaultClient
    >
    }

    // method to execute the plugin
    public async executeSingle(params: ExecuteSingleParams): Promise<ExecuteResult> {
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
        // load from cache
        const cacheKey = createCacheKey("Kamino-Vault", params)
        const cachedData = await this.cacheManager.get(cacheKey)
        if (cachedData) {
            return cachedData as ExecuteResult
        }
        const vaults = await this.getData({
            network: params.network,
            chainKey: params.chainKey,
            inputTokens: [token],
        })
        const result: ExecuteResult = {
            strategies: [],
        }
        const promises = Array<Promise<void>>()
        for (const vault of vaults as Array<KaminoVault>) {
            promises.push(
                (async () => {
                    const apy = vault.apr
                    const strategy: ExecuteStrategy = {
                        outputTokens: [
                            {
                                tokenAddress: vault.shareMint,
                                amount: vault.sharePrice * (params.inputToken.amount || 1),
                            },
                        ],
                        apr: {
                            apr: computePercentage(apy, 1, 5),
                        },
                        metadata: {
                            vaultId: vault.id,
                        },
                    }
                    result.strategies.push(strategy)
                })(),
            )
        }
        await Promise.all(promises)
        await this.cacheManager.set<ExecuteResult>(cacheKey, result)
        return result
    }

    public async execute(
        params: ExecuteParams
    ): Promise<ExecuteResult> {
        const result: ExecuteResult = {
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
                    result.strategies.push(...singleResult.strategies)
                })()
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
  