import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoVaultClient,
} from "@kamino-finance/klend-sdk"
import { Inject, Injectable, OnApplicationBootstrap, OnModuleInit } from "@nestjs/common"
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
import {
    KaminoVaultApiService,
    VaultMetricsHistoryItem,
} from "./kamino-api.service"
import { Cron, CronExpression } from "@nestjs/schedule"
import dayjs from "dayjs"
import { Logger } from "@nestjs/common"
import { RegressionService, Point } from "@/modules/probability-statistics"
import { VaultsData } from "./kamino-level.service"
import { LockService, RetryService } from "@/modules/misc"
import { KaminoVaultIndexerService } from "./kamino-indexer.service"
import { KaminoVaultCacheService } from "./kamino-cache.service"
import { KaminoVaultLevelService } from "./kamino-level.service"

const DAY = 60 * 60 * 24
const LOCK_KEYS = {
    VAULTS_DATA: "vaultsData",
    VAULT_METADATA: "vaultMetadata",
}

@Injectable()
export class KaminoVaultFetchService implements OnApplicationBootstrap, OnModuleInit {
    private kaminoVaultClients: Record<Network, KaminoVaultClient>
    private logger = new Logger(KaminoVaultFetchService.name)

    constructor(
        private readonly kaminoVaultLevelService: KaminoVaultLevelService,
        private readonly kaminoVaultCacheService: KaminoVaultCacheService,
        @Inject(createProviderToken(ChainKey.Solana))
        private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
        private readonly kaminoVaultApiService: KaminoVaultApiService,
        private readonly regressionService: RegressionService,
        private readonly indexerService: KaminoVaultIndexerService,
        private readonly lockService: LockService,
        private readonly retryService: RetryService,
    ) { }

    async onModuleInit() {
        // init kamino vault clients
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

    onApplicationBootstrap() { 
        this.handleLoadVaultsData()
    }

    // fetch api each 1s to ensure the api call not bri
    @Cron(CronExpression.EVERY_SECOND)
    async handleLoadVaultMetadata() {
        for (const network of Object.values(Network)) {
            await this.loadVaultMetadata(network)
        }
    }

    @Cron(CronExpression.EVERY_10_HOURS)
    async handleLoadVaultsData() {
        for (const network of Object.values(Network)) {
            await this.loadVaultsData(network)
        }
    }

    private async loadVaultsData(network: Network) {
        await this.retryService.retry({
            action: async () => {
                this.lockService.withLocks({
                    blockedKeys: [LOCK_KEYS.VAULT_METADATA],
                    acquiredKeys: [LOCK_KEYS.VAULTS_DATA],
                    releaseKeys: [LOCK_KEYS.VAULTS_DATA],
                    network,
                    callback: async () => {
                        try {
                            if (network === Network.Testnet) return

                            if (!this.kaminoVaultClients?.[network]) {
                                this.logger.warn(
                                    `KaminoVaultClient not initialized for ${network}`,
                                )
                                return
                            }
                            const vaultsData = await this.kaminoVaultLevelService.getVaultsData(
                                network,
                                async () => {
                                    const vaultsRaw =
                                await this.kaminoVaultClients[network].getVaults()
                                    const vaultsMapped: VaultsData = {
                                        vaults: vaultsRaw.map((vaultRaw) => ({
                                            state: vaultRaw?.state?.toJSON(),
                                            address: vaultRaw?.address,
                                        })),
                                        currentIndex: 0,
                                    }
                                    return vaultsMapped
                                },
                            )
                            if (!vaultsData) {
                                this.logger.warn(`No vaults found for ${network}`)
                                return
                            }
                            this.indexerService.setVaultsAndCurrentIndex(
                                network,
                                vaultsData.vaults.map((vault) => ({
                                    vaultId: vault.address?.toString() || "",
                                })),
                                vaultsData.currentIndex,
                            )
                            this.logger.verbose(
                                `Loaded ${vaultsData.vaults.length} vaults for ${network} from API.`,
                            )
                        } catch (error) {
                            this.logger.error(
                                `Error loading vaults for ${network}: ${error.message}`,
                            )
                        }
                    },
                })
                   
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

    private async loadVaultMetadata(network: Network) {
        this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.VAULT_METADATA, LOCK_KEYS.VAULTS_DATA],
            acquiredKeys: [LOCK_KEYS.VAULT_METADATA],
            // not authorize to release the vaults lock
            releaseKeys: [LOCK_KEYS.VAULT_METADATA],
            network,
            callback: async () => {
                if (network === Network.Testnet) return
                const currentIndex = this.indexerService.getCurrentIndex(network)
                const vaults = this.indexerService.getVaults(network)
                const vaultToLoad = vaults[currentIndex]
                if (!vaults?.length) return
                try {
                    if (!this.kaminoVaultClients?.[network]) {
                        this.logger.warn(
                            `KaminoVaultClient not initialized for ${network}`,
                        )
                        return
                    }
                    // if current index is greater than the length of the vaults, return
                    if (currentIndex >= vaults.length) {
                        this.logger.debug(
                            `Reached end of vault list for ${network}, stopping fetch.`,
                        )
                        return
                    }
                    if (!vaultToLoad?.vaultId) {
                        this.logger.error(
                            `Vault address missing for index ${currentIndex} (${network})`,
                        )
                        return
                    }
                    const storedVaultsData = await this.kaminoVaultCacheService.getVaultsData(network)
                    const vaultMetadata = await this.kaminoVaultLevelService.getVaultMetadata(
                        network,
                        vaultToLoad.vaultId,
                        async () => {
                            // Fetch metrics from API
                            const metrics = await this.kaminoVaultApiService.getVaultMetrics({
                                vaultPubkey: vaultToLoad.vaultId,
                            })
                            // Fetch metrics history from API (1 year)
                            const metricsHistory =
                                await this.kaminoVaultApiService.getVaultMetricsHistory({
                                    vaultPubkey: vaultToLoad.vaultId,
                                    startDate: dayjs().subtract(1, "year").toISOString(),
                                    endDate: dayjs().toISOString(),
                                })
                            // Compute regression for apy, sharePrice, tvl
                            const { apyRegression, sharePriceRegression, tvlRegression } =
                                await this.computeRegression(metricsHistory)
                            // Onchain shareMint token spl metadata
                            return {
                                address: vaultToLoad.vaultId,
                                metrics,
                                state: storedVaultsData?.vaults.find(vault => vault.address?.toString() === vaultToLoad.vaultId)?.state,
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
                    )
                    if (!vaultMetadata) {
                        this.logger.debug(
                            `Vault not found for ${network}`,
                        )
                        return
                    }
                    await this.kaminoVaultCacheService.cacheVault(
                        network,
                        vaultToLoad.vaultId,
                        vaultMetadata,
                    )
                    this.logger.debug(
                        `Updated vault ${vaultToLoad.vaultId} (${network}) from API`,
                    )
                } catch (error) {
                    this.logger.error(
                        `Error loading vault ${vaultToLoad?.vaultId} (${network}): ${error.message}`,
                        error,
                    )
                } finally {
                    try {
                        this.indexerService.nextCurrentIndex(network)
                        // update the vaults data
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
