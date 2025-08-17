import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common"
import {
    Network,
    StrategyRewardToken,
    TokenType,
} from "@/modules/common"
import dayjs from "dayjs"
import { RegressionService, Point } from "@/modules/probability-statistics"

import {
    SolendLendingApiService,
    HistoricalInterestRatesResponse,
} from "./solend-api.service"
import { Cron, CronExpression } from "@nestjs/schedule"
import { SolendLendingRpcService } from "./solend-rpc.service"
import { randomUUID } from "crypto"
import { SolendLendingIndexerService } from "./solend-indexer.service"
import { LockService, RetryService } from "@/modules/misc"
import { SolendLendingCacheService } from "./solend-cache.service"
import { LendingPool, LendingReserve, SolendLendingLevelService } from "./solend-level.service"

const DAY = 60 * 60 * 24
const LOCK_KEYS = {
    LENDING_POOLS: "lending-pools",
    RESERVE_METADATA: "reserve-metadata",
}

@Injectable()
export class SolendLendingFetchService implements OnApplicationBootstrap {
    private logger = new Logger(SolendLendingFetchService.name)
    
    constructor(
        private readonly solendLendingApiService: SolendLendingApiService,
        private readonly solendLendingRpcService: SolendLendingRpcService,
        private readonly regressionService: RegressionService,
        private readonly solendLendingIndexerService: SolendLendingIndexerService,
        private readonly lockService: LockService,
        private readonly solendLendingLevelService: SolendLendingLevelService,
        private readonly solendLendingCacheService: SolendLendingCacheService,
        private readonly retryService: RetryService,
    ) { }

    onApplicationBootstrap() {
        this.handleLoadLendingPoolsData()
    }

    // Load lending pools each week
    @Cron(CronExpression.EVERY_WEEK)
    async handleLoadLendingPoolsData() {
        for (const network of Object.values(Network)) {
            await this.loadLendingPoolsData(network)
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

                    const metadata = await this.solendLendingLevelService.getLendingReserveMetadata(
                        network,
                        reserve.reserveId,
                        async () => {
                            const results = await this.solendLendingApiService.getHistoricalInterestRates({
                                ids: [reserve.reserveId],
                                span: "1d",
                            })
                    
                            if (!results || !results[reserve.reserveId]) {
                                throw new Error(`No results found with id ${reserve.reserveId}`)
                            }
                    
                            const strategyAnalysis = this.computeRegression(
                                results,
                                reserve.reserveId,
                            )
                    
                            return {
                                metricsHistory: results[reserve.reserveId],
                                strategyAnalysis: strategyAnalysis,
                            }
                        }
                    )
                    if (!metadata) {
                        this.logger.warn(`No metadata found for ${network} reserve ${reserve.reserveId}`)
                        return
                    }
                    await this.solendLendingCacheService.cacheLendingReserveMetadata(network, reserve.reserveId, metadata)
                    this.logger.verbose(`Loaded metadata for ${network} reserve ${reserve.reserveId}`)
                } catch (error) {
                    this.logger.error(
                        `Error loading metadata for ${network} reserve: ${error.message}`,
                        error.stack,
                    )
                } finally {
                    this.retryService.retry({
                        action: async () => {
                            this.solendLendingLevelService.increaseCurrentIndex(network)
                        },
                    })
                }
            },
        })
    }

    async loadLendingPoolsData(network: Network) {
        this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.LENDING_POOLS],
            acquiredKeys: [LOCK_KEYS.LENDING_POOLS],
            releaseKeys: [LOCK_KEYS.LENDING_POOLS],
            network,
            callback: async () => {
                try {
                    if (network === Network.Testnet) return
                    const lendingPoolsData = await this.solendLendingLevelService.getLendingPoolsData(
                        network, 
                        async () => {
                            const { results: markets } = await this.solendLendingApiService.getMarkets(
                                "all",
                                network,
                            )
                            const reserves = await this.solendLendingRpcService.fetchReserves({
                                network,
                            })
                            const rewards = await this.solendLendingApiService.getExternalRewardStats()
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
                    )
                    if (!lendingPoolsData) {
                        this.logger.warn(`No lending pools data found for ${network}`)
                        return
                    }
                    // Update indexer service with new data
                    await this.solendLendingCacheService.cacheLendingPoolsData(network, lendingPoolsData)
                    this.solendLendingIndexerService.setReserveAndCurrentIndex(
                        network, 
                        lendingPoolsData
                            .pools
                            .flatMap(pool =>
                                pool.reserves.map(reserve => ({
                                    reserveId: reserve.reserve.address
                                }))
                            ),
                        lendingPoolsData.currentIndex,
                    )
                    this.logger.verbose(
                        `Loaded ${lendingPoolsData.pools.length} pools for ${network} from API or volume fallback.`,
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
