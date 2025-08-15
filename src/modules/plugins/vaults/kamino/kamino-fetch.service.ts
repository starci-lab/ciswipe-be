import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoVaultClient,
} from "@kamino-finance/klend-sdk"
import { Inject, Injectable, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import {
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
    KaminoVaultApiService,
    VaultMetricsHistoryItem,
} from "./kamino-api.service"
import { Cron, CronExpression } from "@nestjs/schedule"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import dayjs from "dayjs"
import { Logger } from "@nestjs/common"
import { RegressionService, Point } from "@/modules/probability-statistics"
import { KaminoVaultIndexerService, VaultRawsData, Vault } from "./kamino-indexer.service"
import { KaminoVaultInitService } from "./kamino-init.service"
import { LockService } from "@/modules/misc"
import { FOLDER_NAMES } from "./constants"
const DAY = 60 * 60 * 24
const LOCK_KEYS = {
    VAULTS: "vaults",
    VAULT: "vault",
}

@Injectable()
export class KaminoVaultFetchService implements OnModuleInit {
    private kaminoVaultClients: Record<Network, KaminoVaultClient>
    private logger = new Logger(KaminoVaultFetchService.name)

    constructor(
        private readonly volumeService: VolumeService,
        @Inject(createProviderToken(ChainKey.Solana))
        private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
        private readonly kaminoApiService: KaminoVaultApiService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly regressionService: RegressionService,
        private readonly indexerService: KaminoVaultIndexerService,
        private readonly lockService: LockService,
        private readonly initService: KaminoVaultInitService,
    ) { }

    async onModuleInit() {
        await this.initService.cacheAllOnInit()
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
        this.handleLoadVaults()
    }

    // fetch api each 1s to ensure the api call not bri
    @Cron(CronExpression.EVERY_SECOND)
    async handleLoadVault() {
        for (const network of Object.values(Network)) {
            await this.loadVault(network)
        }
    }

    @Cron(CronExpression.EVERY_10_HOURS)
    async handleLoadVaults() {
        for (const network of Object.values(Network)) {
            await this.loadVaults(network)
        }
    }

    private async loadVaults(network: Network) {
        this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.VAULT],
            acquiredKeys: [LOCK_KEYS.VAULTS],
            releaseKeys: [LOCK_KEYS.VAULTS],
            network,
            callback: async () => {
                try {
                    if (network === Network.Testnet) return

                    if (!this.kaminoVaultClients?.[network]) {
                        this.logger.warn(`KaminoVaultClient not initialized for ${network}`)
                        return
                    }

                    const volumeKey = this.initService.getVaultsVolumeKey(network)
                    const vaultsCacheKey = this.initService.getVaultsCacheKey(network)

                    const vaults =
                        await this.volumeService.tryActionOrFallbackToVolume<VaultRawsData>({
                            name: volumeKey,
                            action: async () => {
                                const vaultsRaw =
                                    await this.kaminoVaultClients[network].getVaults()
                                const vaultsMapped: VaultRawsData = {
                                    vaults: vaultsRaw.map((vaultRaw) => ({
                                        state: vaultRaw?.state?.toJSON(),
                                        address: vaultRaw?.address,
                                    })),
                                    currentIndex: 0,
                                }
                                return vaultsMapped
                            },
                            folderNames: FOLDER_NAMES,
                        })
                    this.indexerService.setVaults(network, vaults.vaults)
                    this.indexerService.setCurrentIndex(network, vaults.currentIndex)
                    await this.cacheManager.set(vaultsCacheKey, vaults)
                    this.logger.verbose(
                        `Loaded ${vaults.vaults.length} vaults for ${network} from API or volume fallback.`,
                    )
                } catch (error) {
                    this.logger.error(
                        `Error loading vaults for ${network}: ${error.message}`,
                    )
                }
            }
        })  
    }

    private async computeRegression(
        metricsHistory: Array<VaultMetricsHistoryItem>,
    ) {
        const apySamples: Array<Point> = metricsHistory.map((metric) => ({
            x: dayjs(metric.timestamp).unix(),
            y: Number(metric.apy),
        }))
        const sharePriceSamples: Array<Point> = metricsHistory.map((metric) => ({
            x: dayjs(metric.timestamp).unix(),
            y: Number(metric.sharePrice),
        }))
        const tvlSamples: Array<Point> = metricsHistory.map((metric) => ({
            x: dayjs(metric.timestamp).unix(),
            y: Number(metric.tvl),
        }))
        const apyRegression = this.regressionService.computeRegression(apySamples)
        const sharePriceRegression =
            this.regressionService.computeRegression(sharePriceSamples)
        const tvlRegression = this.regressionService.computeRegression(tvlSamples)
        return {
            apyRegression,
            sharePriceRegression,
            tvlRegression,
        }
    }

    private async loadVault(network: Network) {
        this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.VAULT, LOCK_KEYS.VAULTS],
            acquiredKeys: [LOCK_KEYS.VAULT],
            // not authorize to release the vaults lock
            releaseKeys: [LOCK_KEYS.VAULT],
            network,
            callback: async () => {
                if (network === Network.Testnet) return
                const currentIndex = this.indexerService.getCurrentIndex(network)
                const vaults = this.indexerService.getVaults(network)
                const vaultToLoad = vaults[currentIndex]
                if (!vaults?.length) return
                try {
                    if (!this.kaminoVaultClients?.[network]) {
                        this.logger.warn(`KaminoVaultClient not initialized for ${network}`)
                        return
                    }
                    // if current index is greater than the length of the vaults, return
                    if (currentIndex >= vaults.length) {
                        this.logger.debug(
                            `Reached end of vault list for ${network}, stopping fetch.`,
                        )
                        return
                    }
                    if (!vaultToLoad?.address) {
                        this.logger.error(
                            `Vault address missing for index ${currentIndex} (${network})`,
                        )
                        return
                    }
                    const vaultVolumeName = this.initService.getVaultVolumeKey(
                        network,
                        vaultToLoad.address.toString(),
                    )
                    const vaultCacheKey = this.initService.getVaultCacheKey(
                        network,
                        vaultToLoad.address,
                    )
                    const vault =
                        await this.volumeService.tryActionOrFallbackToVolume<Vault>({
                            name: vaultVolumeName,
                            folderNames: FOLDER_NAMES,
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
                                // Compute regression for apy, sharePrice, tvl
                                const { apyRegression, sharePriceRegression, tvlRegression } =
                                    await this.computeRegression(metricsHistory)
                                // Onchain shareMint token spl metadata
                                return {
                                    address: vaultToLoad.address.toString(),
                                    metrics,
                                    state: vaultToLoad.state,
                                    metricsHistory,
                                    strategyAnalysis: {
                                        apyAnalysis: {
                                            confidenceScore: apyRegression.rSquared,
                                            growthDaily: apyRegression.slope * DAY,
                                            growthWeekly: apyRegression.slope * DAY * 7,
                                            growthMonthly: apyRegression.slope * DAY * 30,
                                            growthYearly: apyRegression.slope * DAY * 365,
                                            intercept: apyRegression.intercept,
                                        },
                                        shareTokenPriceAnalysis: {
                                            confidenceScore: sharePriceRegression.rSquared,
                                            growthDaily: sharePriceRegression.slope * DAY,
                                            growthWeekly: sharePriceRegression.slope * DAY * 7,
                                            growthMonthly: sharePriceRegression.slope * DAY * 30,
                                            growthYearly: sharePriceRegression.slope * DAY * 365,
                                            intercept: sharePriceRegression.intercept,
                                        },
                                        tvlAnalysis: {
                                            confidenceScore: tvlRegression.rSquared,
                                            growthDaily: tvlRegression.slope * DAY,
                                            growthWeekly: tvlRegression.slope * DAY * 7,
                                            growthMonthly: tvlRegression.slope * DAY * 30,
                                            growthYearly: tvlRegression.slope * DAY * 365,
                                            intercept: tvlRegression.intercept,
                                        },
                                    },
                                }
                            },
                        })
                    await this.cacheManager.set(vaultCacheKey, vault)
                    this.logger.debug(
                        `Updated vault ${vaultToLoad.address} (${network}) from API`,
                    )
                } catch (error) {
                    this.logger.error(
                        `Error loading vault ${vaultToLoad?.address} (${network}): ${error.message}`,
                        error,
                    )
                } finally {
                    try {
                        this.indexerService.nextIndex(network)
                        // update the vaults data
                        await this.volumeService.updateJsonFromDataVolume<VaultRawsData>({
                            name: this.initService.getVaultsVolumeKey(network),
                            folderNames: FOLDER_NAMES,
                            updateFn: (prevData) => {
                                prevData.currentIndex =
                                    this.indexerService.getCurrentIndex(network)
                                return prevData
                            },
                        })
                    } catch (error) {
                        this.logger.error(
                            `Error updating current index for ${network}: ${error.message}`,
                            error.stack,
                        )
                    }
                }
            },
        })
    }
}
