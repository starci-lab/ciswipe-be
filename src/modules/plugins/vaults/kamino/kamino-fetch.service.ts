import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoVaultClient,
    VaultStateJSON,
} from "@kamino-finance/klend-sdk"
import { Inject, Injectable, OnModuleInit } from "@nestjs/common"
import { AIAnalysis, ChainKey, Network } from "@/modules/common"
import {
    Address,
    createDefaultRpcTransport,
    createRpc,
    createSolanaRpcApi,
    DEFAULT_RPC_CONFIG,
    SolanaRpcApi,
} from "@solana/kit"
import { Connection } from "@solana/web3.js"
import { createProviderToken, RecordRpcProvider } from "@/modules/blockchain"
import { VolumeService } from "@/modules/volume"
import {
    KaminoApiService,
    VaultMetrics,
    VaultMetricsHistoryItem,
} from "./kamino-api.service"
import { Cron, CronExpression, Interval } from "@nestjs/schedule"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { createCacheKey } from "@/modules/cache"
import dayjs from "dayjs"
import { Logger } from "@nestjs/common"
import { envConfig } from "@/modules/env"
import { MetricAnalyzerGroupBy, MetricAnalyzerService } from "@/modules/ai"

export interface VaultRaw {
    state: VaultStateJSON | undefined;
    address: Address | undefined;
}

export interface Vault {
    // address of the vault
    address: string;
    // metrics of the vault, about the apr, etc
    metrics: VaultMetrics;
    // state of the vault, about the vault address, etc
    state: VaultStateJSON | undefined;
    // metrics history of the vault, about the apr, etc
    metricsHistory: Array<VaultMetricsHistoryItem>;
    // ai analysis
    aiAnalysis: AIAnalysis,
}

@Injectable()
export class KaminoVaultFetchService implements OnModuleInit {
    private debug = envConfig().debug.kaminoVaultFetch
    private kaminoVaultClients: Record<Network, KaminoVaultClient>
    private logger = new Logger(KaminoVaultFetchService.name)
    private vaults: Record<Network, Array<VaultRaw>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }
    // current index is the index of the vault to load
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }
    constructor(
        private readonly volumeService: VolumeService,
        @Inject(createProviderToken(ChainKey.Solana))
        private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
        private readonly kaminoApiService: KaminoApiService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly metricAnalyzerService: MetricAnalyzerService,
    ) { }

    async onModuleInit() {
        try {
            const _kaminoVaultClients: Partial<Record<Network, KaminoVaultClient>> =
                {}
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
            // cache the vaults at initial
            if (this.debug) {
                this.handleLoadVaults()
            }
        } catch (error) {
            this.logger.error(error)
        }
    }

    // fetch api each 1s to ensure the api call not bri
    @Interval(1000)
    async handleLoadVault() {
        for (const network of Object.values(Network)) {
            await this.loadVault(network)
        }
    }

    public getVaultsCacheKey(network: Network) {
        return createCacheKey("kamino-vaults", {
            network,
        })
    }

    public getVaultCacheKey(network: Network, vaultAddress: Address) {
        return createCacheKey("kamino-vault", {
            vaultAddress,
            network,
        })
    }

    private getVolumeKey(network: Network) {
        return `kamino-vaults-${network}.json`
    }

    @Cron(CronExpression.EVERY_10_HOURS)
    async handleLoadVaults() {
        for (const network of Object.values(Network)) {
            await this.loadVaults(network)
        }
    }

    private async loadVaults(network: Network) {
        if (network === Network.Testnet) return

        if (!this.kaminoVaultClients?.[network]) {
            this.logger.warn(`KaminoVaultClient not initialized for ${network}`)
            return
        }

        const volumeKey = this.getVolumeKey(network)
        const vaultsCacheKey = this.getVaultsCacheKey(network)

        const vaults = await this.volumeService.tryActionOrFallbackToVolume<
            Array<VaultRaw>
        >({
            name: volumeKey,
            action: async () => {
                const vaultsRaw = await this.kaminoVaultClients[network].getVaults()
                const vaultsMapped: Array<VaultRaw> = vaultsRaw.map((vaultRaw) => ({
                    state: vaultRaw?.state?.toJSON(),
                    address: vaultRaw?.address,
                }))
                // store to volume
                await this.volumeService.writeJsonToDataVolume(volumeKey, vaultsMapped)
                return vaultsMapped
            },
        })

        this.vaults[network] = vaults
        this.currentIndex[network] = 0
        await this.cacheManager.set(vaultsCacheKey, vaults)

        this.logger.log(
            `Loaded ${vaults.length} vaults for ${network} from API or volume fallback.`,
        )
    }

    private async loadVault(network: Network) {
        if (network === Network.Testnet) return
        if (!this.vaults[network]?.length) return
        if (!this.kaminoVaultClients?.[network]) {
            this.logger.warn(`KaminoVaultClient not initialized for ${network}`)
            return
        }
        const currentIdx = this.currentIndex[network]
        // if current index is greater than the length of the vaults, return
        if (currentIdx >= this.vaults[network].length) {
            this.logger.debug(
                `Reached end of vault list for ${network}, stopping fetch.`,
            )
            return
        }
        const vaultToLoad = this.vaults[network][currentIdx]
        if (!vaultToLoad?.address) {
            this.logger.error(
                `Vault address missing for index ${currentIdx} (${network})`,
            )
            return
        }
        const vaultVolumeName = `kamino-vault-${network}-${vaultToLoad.address}.json`
        const vaultCacheKey = this.getVaultCacheKey(network, vaultToLoad.address)
        const vault = await this.volumeService.tryActionOrFallbackToVolume<Vault>({
            name: vaultVolumeName,
            action: async () => {
                if (!vaultToLoad.address) {
                    throw new Error("Vault address not found")
                }
                // Fetch metrics from API
                const metrics = await this.kaminoApiService.getVaultMetrics({
                    vaultPubkey: vaultToLoad.address?.toString(),
                })
                // Fetch metrics history from API (1 year)
                const metricsHistory =
                    await this.kaminoApiService.getVaultMetricsHistory({
                        vaultPubkey: vaultToLoad.address.toString(),
                        startDate: dayjs().subtract(1, "year").toISOString(),
                        endDate: dayjs().toISOString(),
                    })
                // Onchain shareMint token spl metadata
                return {
                    address: vaultToLoad.address.toString(),
                    metrics,
                    state: vaultToLoad.state,
                    metricsHistory,
                    aiAnalysis: await this.metricAnalyzerService.analyzeSummary<{
                    confidenceScore: number;
                    safeScore: number;
                    statisticalAnalysis: string;
                  }>({
                      points: metricsHistory.map((metric) => ({
                          date: metric.timestamp,
                          fields: metric,
                      })),
                      resultJsonFields: [
                          {
                              confidenceScore: "number",
                              safeScore: "number",
                              statisticalAnalysis: "string",
                          },
                      ],
                      numericFields: ["apy", "interestUsd", "sharePrice", "tvl"],
                      groupBy: MetricAnalyzerGroupBy.Month,
                      prompt: `
                                ANALYSIS REQUEST:
Analyze these vault metrics and provide:
1. confidenceScore (0-1): Your certainty in this assessment
2. safeScore (0-1): Investment safety level
3. statisticalAnalysis: Key findings

STRICT OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- No additional text/comments
- Round scores to 2 decimal places
- Use this exact structure:
                                `,
                  }),
                }
            },
        })
        await this.cacheManager.set(vaultCacheKey, vault)
        this.currentIndex[network] += 1
        this.logger.debug(
            `Updated vault ${vaultToLoad.address} (${network}) from API`,
        )
    }
}
