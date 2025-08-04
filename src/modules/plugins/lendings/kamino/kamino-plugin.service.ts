import {
    ChainKey,
    createProviderToken,
    Network,
    RecordRpcProvider,
    TokenId,
    tokens,
    TokenType,
} from "@/modules/blockchain"
import {
    GetDataParams,
    LendParams,
    LendingOutputResult,
    LendingOutputStrategy,
    LendingOutputStrategyType,
} from "../abstract"
import {
    Inject,
    Injectable,
    OnApplicationBootstrap,
    OnModuleInit,
} from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { VolumeService } from "@/modules/volume"
import { LendingPluginAbstract } from "../abstract"
import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoManager,
    KaminoVault,
} from "@kamino-finance/klend-sdk"
import { assertIsAddress } from "@solana/addresses"
import {
    DEFAULT_RPC_CONFIG,
    createSolanaRpcApi,
    SolanaRpcApi,
    createRpc,
    createDefaultRpcTransport,
} from "@solana/kit"
import { createCacheKey } from "@/modules/cache"
import { computePercentage } from "@/modules/common"

@Injectable()
export class KaminoPluginService
    extends LendingPluginAbstract
    implements OnModuleInit, OnApplicationBootstrap
{
    private kaminoManagers: Record<Network, KaminoManager>
    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly volumeService: VolumeService,
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

    protected async getData(params: GetDataParams): Promise<Array<KaminoVault>> {
        const volumeName = `kamino-${params.inputToken.id}.json`
        try {
            if (!params.inputToken.tokenAddress) {
                throw new Error("Token address is required")
            }
            const kaminoManager = this.kaminoManagers[params.network]
            assertIsAddress(params.inputToken.tokenAddress)
            const vaults = await kaminoManager.getAllVaultsForToken(
                params.inputToken.tokenAddress,
            )
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
    async onApplicationBootstrap() {
        const output = await this.lend({
            network: Network.Mainnet,
            chainKey: ChainKey.Solana,
            inputToken: {
                id: TokenId.SolanaUsdcMainnet,
                amount: 1,
            },
            disableCache: false,
        })
        console.dir(output, { depth: null })
    }

    async onModuleInit() {
        const _kaminoManagers: Partial<Record<Network, KaminoManager>> = {}
        for (const network of Object.values(Network)) {
            const slotDuration = await getMedianSlotDurationInMsFromLastEpochs()
            const api = createSolanaRpcApi<SolanaRpcApi>({
                ...DEFAULT_RPC_CONFIG,
                defaultCommitment: "confirmed",
            })
            _kaminoManagers[network] = new KaminoManager(
                createRpc({
                    api,
                    transport: createDefaultRpcTransport({
                        url: this.solanaRpcProvider[network].rpcEndpoint,
                    }),
                }),
                slotDuration,
            )
        }
        this.kaminoManagers = _kaminoManagers as Record<Network, KaminoManager>
    }

    // method to add liquidity to a pool
    protected async lend(params: LendParams): Promise<LendingOutputResult> {
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
        const cacheKey = createCacheKey("Kamino", params)
        const cachedData = await this.cacheManager.get(cacheKey)
        if (cachedData) {
            return cachedData as LendingOutputResult
        }

        const vaults = await this.getData({
            network: params.network,
            chainKey: params.chainKey,
            inputToken: token,
        })
        const result: LendingOutputResult = {
            strategies: [],
        }
        console.log("called")
        const slot = await this.solanaRpcProvider[params.network].getSlot()
        const bigIntSlot = BigInt(slot)
        const promises = Array<Promise<void>>()
        for (const vault of vaults) {
            promises.push(
                (async () => {
                    if (!vault.state) {
                        return
                    }
                    const apy = await this.kaminoManagers[
                        params.network
                    ].getVaultActualAPY(vault.state, bigIntSlot)
                    const strategy: LendingOutputStrategy = {
                        outputTokens: [
                            {
                                tokenAddress: vault.state.sharesMint,
                            },
                        ],
                        apy: {
                            apy: computePercentage(apy.grossAPY.toNumber(), 1, 5),
                            netApy: apy.netAPY
                                ? computePercentage(apy.netAPY.toNumber(), 1, 5)
                                : undefined,
                        },
                        type: LendingOutputStrategyType.Lending,
                        metadata: {
                            vaultId: vault.address,
                        },
                    }
                    result.strategies.push(strategy)
                })(),
            )
        }
        await Promise.all(promises)
        await this.cacheManager.set<LendingOutputResult>(cacheKey, result)
        return result
    }
}
