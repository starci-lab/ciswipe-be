import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import {
    Network,
    StrategyAnalysis,
    StrategyRewards,
    StrategyRewardToken,
    TokenType,
} from "@/modules/common"
import dayjs from "dayjs"
import { VolumeService } from "@/modules/volume"
import { RegressionService, Point } from "@/modules/probability-statistics"

import {
    HistoricalInterestRateItem,
    HistoricalInterestRatesResponse,
    SolendLendingApiService,
    Market,
} from "./solend-api.service"
import { Cron, CronExpression } from "@nestjs/schedule"
import { SolendRpcService } from "./solend-rpc.service"
import { randomUUID } from "crypto"
import { SolendLendingInitService } from "./solend-init.service"
import { SolendLendingIndexerService } from "./solend-indexer.service"
import { FOLDER_NAMES } from "./constants"
import { LockService } from "@/modules/misc"
import { WithAddressAndStats } from "./solend-rpc.service"
import { Reserve } from "./schema"

const DAY = 60 * 60 * 24
const LOCK_KEYS = {
    LENDING_POOLS: "lending-pools",
    RESERVE_METADATA: "reserve-metadata",
}

export interface LendingReserve {
    reserve: WithAddressAndStats<Reserve>;
    rewards: StrategyRewards;
}

export interface LendingReserveMetadata {
    metricsHistory: Array<HistoricalInterestRateItem>;
    strategyAnalysis: StrategyAnalysis;
}
export interface LendingPool {
    market: Market;
    reserves: Array<LendingReserve>;
}

export interface PoolsData {
    pools: Array<LendingPool>;
    currentIndex: number;
}    

@Injectable()
export class SolendLendingFetchService implements OnModuleInit {
    private logger = new Logger(SolendLendingFetchService.name)
    
    constructor(
        private readonly volumeService: VolumeService,
        private readonly solendApiService: SolendLendingApiService,
        private readonly solendRpcService: SolendRpcService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly regressionService: RegressionService,
        private readonly solendLendingInitService: SolendLendingInitService,
        private readonly solendLendingIndexerService: SolendLendingIndexerService,
        private readonly lockService: LockService,
    ) { }

    // we trigger fetch on init to ensure we have all the data in cache
    async onModuleInit() {
        await this.solendLendingInitService.cacheAllOnInit()
        await this.handleLoadLendingPools()
    }

    // Load lending pools each week
    @Cron(CronExpression.EVERY_WEEK)
    async handleLoadLendingPools() {
        for (const network of Object.values(Network)) {
            await this.loadLendingPools(network)
        }
    }

    @Cron(CronExpression.EVERY_SECOND)
    async handleLoadReserveMetadata() {
        for (const network of Object.values(Network)) {
            await this.loadReserveMetadata(network)
        }
    }

    async loadReserveMetadata(network: Network) {
        this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.RESERVE_METADATA, LOCK_KEYS.LENDING_POOLS],
            acquiredKeys: [LOCK_KEYS.RESERVE_METADATA],
            // not authorize to release the lending pools lock
            releaseKeys: [LOCK_KEYS.RESERVE_METADATA],
            network,
            callback: async () => {
                const currentIndex = this.solendLendingIndexerService.getCurrentIndex(network)
                const reserves = this.solendLendingIndexerService.getReserves(network)
                if (!reserves?.length) {
                    this.logger.verbose(`No reserves to load for ${network}`)
                    return
                }
                try {
                    if (network === Network.Testnet) return
                    if (!reserves?.length) {
                        this.logger.verbose(`No reserves to load for ${network}`)
                        return
                    }
            
                    if (typeof currentIndex === "undefined") {
                        this.solendLendingIndexerService.setCurrentIndex(network, 0)
                        return
                    }
            
                    if (currentIndex >= reserves.length) {
                        this.logger.verbose(`No more reserves to load for ${network}`)
                        return
                    }
            
                    const reserve = reserves[currentIndex]
                    if (!reserve) {
                        this.logger.warn(`No reserve found at index ${currentIndex} for ${network}`)
                        return
                    }

                    const reserveMetadataVolumeKey = this.solendLendingInitService.getReserveMetadataVolumeKey(
                        network,
                        reserve.address,
                    )
            
                    const metadata = await this.volumeService.tryActionOrFallbackToVolume<LendingReserveMetadata>(
                        {
                            name: reserveMetadataVolumeKey,
                            action: async (): Promise<LendingReserveMetadata> => {
                                const results = await this.solendApiService.getHistoricalInterestRates({
                                    ids: [reserve.address],
                                    span: "1d",
                                })
                        
                                if (!results || !results[reserve.address]) {
                                    throw new Error(`No results found with id ${reserve.address}`)
                                }
                        
                                const strategyAnalysis = this.computeRegression(
                                    results,
                                    reserve.address,
                                )
                        
                                return {
                                    metricsHistory: results[reserve.address],
                                    strategyAnalysis: strategyAnalysis,
                                }
                            },
                            folderNames: FOLDER_NAMES,
                        },
                    )
            
                    // store in cache
                    await this.cacheManager.set(
                        this.solendLendingInitService.getReserveMetadataCacheKey(network, reserve.address),
                        metadata,
                    )
                    this.logger.verbose(
                        `Loaded historical interest rates for ${network} reserve ${reserve.address}`,
                    )
                } catch (error) {
                    this.logger.error(
                        `Error loading metadata for ${network} reserve: ${error.message}`,
                        error.stack,
                    )
                } finally {
                    try {
                        // plus to next index, regardless of success or failure
                        this.solendLendingIndexerService.nextCurrentIndex(network)
                        // update current index in volume
                        await this.volumeService.updateJsonFromDataVolume<PoolsData>({
                            name: this.solendLendingInitService.getLendingPoolsVolumeKey(network),
                            updateFn: (prevData) => {
                                prevData.currentIndex = this.solendLendingIndexerService.getCurrentIndex(network)
                                return prevData
                            },
                            folderNames: FOLDER_NAMES,
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

    async loadLendingPools(network: Network) {
        this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.LENDING_POOLS],
            acquiredKeys: [LOCK_KEYS.LENDING_POOLS],
            releaseKeys: [LOCK_KEYS.LENDING_POOLS],
            network,
            callback: async () => {
                try {
                    if (network === Network.Testnet) return
                    const lendingPoolsVolumeKey = this.solendLendingInitService.getLendingPoolsVolumeKey(network)
                    const lendingPoolsRaw = await this.volumeService.tryActionOrFallbackToVolume<PoolsData>({
                        name: lendingPoolsVolumeKey,
                        action: async (): Promise<PoolsData> => {
                            const { results: markets } = await this.solendApiService.getMarkets(
                                "all",
                                network,
                            )
                            const reserves = await this.solendRpcService.fetchReserves({
                                network,
                            })
                            const rewards = await this.solendApiService.getExternalRewardStats()
                            const lendingPools: Array<LendingPool> = markets.map((market) => ({
                                market,
                                reserves: reserves.reserves
                                    .filter(
                                        (reserve) => reserve.data.lendingMarket.toBase58() === market.address,
                                    )
                                    .map<LendingReserve>((reserve) => ({
                                        reserve,
                                        rewards: {
                                            rewardTokens: rewards
                                                .filter((reward) => reward.reserveID === reserve.address)
                                                .map<StrategyRewardToken>((reward) => ({
                                                    token: {
                                                        id: randomUUID(),
                                                        address: reward.rewardMint,
                                                        type: TokenType.Regular,
                                                    },
                                                    rewardPerShare: Number(reward.rewardsPerShare),
                                                })),
                                        },
                                    })),
                            }))
                            return {
                                pools: lendingPools,
                                currentIndex: 0,
                            }
                        },
                        folderNames: FOLDER_NAMES,
                    })
                    // Update indexer service with new data
                    this.solendLendingIndexerService.setCurrentIndex(network, lendingPoolsRaw.currentIndex)
                    this.solendLendingIndexerService.setReserves(
                        network, 
                        lendingPoolsRaw.pools
                            .map((pool) => pool.reserves)
                            .flat()
                            .map((reserve) => reserve.reserve))
            
                    // Store in cache
                    await this.cacheManager.set(
                        this.solendLendingInitService.getLendingPoolsCacheKey(network),
                        lendingPoolsRaw,
                    )
            
                    this.logger.verbose(
                        `Loaded ${lendingPoolsRaw.pools.length} pools for ${network} from API or volume fallback.`,
                    )
                } catch (error) {
                    this.logger.error(
                        `Error loading lending pools for ${network}: ${error.message}`,
                        error.stack,
                    )
                }
            },
        })
    }

    private computeRegression(
        metricsHistories: HistoricalInterestRatesResponse,
        reserveId: string,
    ) {
        const apySamples: Array<Point> = metricsHistories[reserveId].map(
            (metricsHistory) => ({
                x: dayjs(metricsHistory.timestamp).unix(),
                y: Number(metricsHistory.supplyAPY),
            }),
        )
        const apyRegression = this.regressionService.computeRegression(apySamples)
        
        const aprSamples: Array<Point> = metricsHistories[reserveId].map(
            (metricsHistory) => ({
                x: dayjs(metricsHistory.timestamp).unix(),
                y: Number(metricsHistory.borrowAPY),
            }),
        )
        const aprRegression = this.regressionService.computeRegression(aprSamples)
        
        const cTokenExchangeRateSamples: Array<Point> = metricsHistories[
            reserveId
        ].map((metricsHistory) => ({
            x: dayjs(metricsHistory.timestamp).unix(),
            y: Number(metricsHistory.cTokenExchangeRate),
        }))
        const cTokenExchangeRateRegression =
            this.regressionService.computeRegression(cTokenExchangeRateSamples)
        
        return {
            apyAnalysis: {
                confidenceScore: apyRegression.rSquared,
                growthDaily: apyRegression.slope * DAY,
                growthWeekly: apyRegression.slope * DAY * 7,
                growthMonthly: apyRegression.slope * DAY * 30,
                growthYearly: apyRegression.slope * DAY * 365,
                intercept: apyRegression.intercept,
            },
            aprAnalysis: {
                confidenceScore: aprRegression.rSquared,
                growthDaily: aprRegression.slope * DAY,
                growthWeekly: aprRegression.slope * DAY * 7,
                growthMonthly: aprRegression.slope * DAY * 30,
                growthYearly: aprRegression.slope * DAY * 365,
                intercept: aprRegression.intercept,
            },
            cTokenExchangeRateAnalysis: {
                confidenceScore: cTokenExchangeRateRegression.rSquared,
                growthDaily: cTokenExchangeRateRegression.slope * DAY,
                growthWeekly: cTokenExchangeRateRegression.slope * DAY * 7,
                growthMonthly: cTokenExchangeRateRegression.slope * DAY * 30,
                growthYearly: cTokenExchangeRateRegression.slope * DAY * 365,
                intercept: cTokenExchangeRateRegression.intercept,
            },
        }
    }
}
