import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { createProviderToken, RecordRpcProvider } from "@/modules/blockchain"
import { ChainKey, Network, StrategyAnalysis } from "@/modules/common"
import { Address } from "@solana/kit"
import { Connection } from "@solana/web3.js"
import dayjs from "dayjs"
import { VolumeService } from "@/modules/volume"
import { RegressionService, Point } from "@/modules/probability-statistics"
import {
    SolendLendingApiService,
    HistoricalInterestRateItem,
    Market
} from "./solend-api.service"
import { ReserveConfigType, SolendMarket, ReserveDataType, SolendReserve } from "@solendprotocol/solend-sdk"
import { Cron, CronExpression } from "@nestjs/schedule"
import { sleep } from "@/modules/common"

export interface LendingRaw {
    address: Address | undefined;
}

export interface JSONReserve {
    config: ReserveConfigType
    stats?: ReserveDataType
    totalBorrowAPY: ReturnType<SolendReserve["totalBorrowAPY"]>
    totalSupplyAPY: ReturnType<SolendReserve["totalSupplyAPY"]>
}

interface LendingVault {
    address: string
    reserve: JSONReserve
    metricsHistory: Array<HistoricalInterestRateItem>
    strategyAnalysis: StrategyAnalysis
}

export interface LendingVaultDatas {
    market: Market
    lendingVaults: Array<LendingVault>
}

export interface MarketExtends {
    markets: Array<Market>
    currentIndex: number
}

const DAY = 60 * 60 * 24
interface SolendMarketData {
    instance: SolendMarket
    timestamp: number
}
@Injectable()
export class SolendLendingFetchService implements OnModuleInit {
    private logger = new Logger(SolendLendingFetchService.name)
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }
    private markets: Record<Network, Array<Market>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }
    // map market address to each solend market instance
    private solendMarkets: Record<Network, Record<string, SolendMarketData>> = {
        [Network.Mainnet]: {},
        [Network.Testnet]: {},
    }

    constructor(
        private readonly volumeService: VolumeService,
        @Inject(createProviderToken(ChainKey.Solana))
        private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
        private readonly solendApiService: SolendLendingApiService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly regressionService: RegressionService,
    ) {}

    async onModuleInit() {
        await this.loadMarkets(Network.Mainnet)
    }

    // load markets each week
    @Cron(CronExpression.EVERY_WEEK)
    async handleLoadMarkets() {
        for (const network of Object.values(Network)) {
            await this.loadMarkets(network)
        }
    }

    // Load lending vaults each 10s
    @Cron(CronExpression.EVERY_10_SECONDS)
    async handleLoadLendingVaults() {
        for (const network of Object.values(Network)) {
            await this.loadLendingVaults(network)
        }
    }

    public getLendingsCacheKey(network: Network) {
        return `solend-lendings-${network}`
    }

    public getMarketsCacheKey(network: Network) {
        return `solend-markets-${network}`
    }

    public getLendingCacheKey(network: Network, marketAddress: string) {
        return `solend-lending-${network}-${marketAddress}`
    }

    private getVolumeKey(network: Network) {
        return `solend-markets-${network}.json`
    }


    async loadMarkets(network: Network) {
        if (network === Network.Testnet) return
        const volumeKey = this.getVolumeKey(network)
        const marketCacheKey = this.getMarketsCacheKey(network)
        const marketsRaw = await this.volumeService.tryActionOrFallbackToVolume<
            MarketExtends
        >({
            name: volumeKey,
            action: async () => {
                const marketsRaw = await this.solendApiService.getMarkets("all", network)
                return {
                    markets: marketsRaw.results,
                    currentIndex: 0,
                }
            },
        })
        this.markets[network] = marketsRaw.markets
        this.currentIndex[network] = marketsRaw.currentIndex
        await this.cacheManager.set(marketCacheKey, marketsRaw)
        this.logger.verbose(
            `Loaded ${marketsRaw.markets.length} markets for ${network} from API or volume fallback.`,
        )
    }

    async loadLendingVaults(network: Network) {
        if (network === Network.Testnet) return
        if (!this.markets[network]?.length) return
        const currentIdx = this.currentIndex[network]
        if (currentIdx >= this.markets[network].length) {
            this.logger.debug(`Reached end of lendings list for ${network}`)
            return
        }
        const marketToLoad = this.markets[network][currentIdx]
        if (!marketToLoad?.address) {
            this.logger.error(`Market address missing for index ${currentIdx} (${network})`)
            return
        }
        if (!this.solendMarkets[network][marketToLoad.address] 
            || dayjs().diff(dayjs.unix(this.solendMarkets[network][marketToLoad.address].timestamp), "day") > 1
        ) {
            const instance = await SolendMarket.initialize(
                this.solanaRpcProvider[network],
            )
            await instance.loadReserves()
            // sleep 1s to ensure the api rate limit is not exceeded
            await sleep(1000)
            await instance.loadRewards()
            // reset each market once a day
            this.solendMarkets[network][marketToLoad.address] = {
                instance,
                timestamp: dayjs().unix(),
            }
        }
        const solendMarket = this.solendMarkets[network][marketToLoad.address].instance
        const lendingCacheKey = this.getLendingCacheKey(network, marketToLoad.address)
        const lendingVolumeName = `solend-lending-${network}-${marketToLoad.address}.json`

        const lendingVaultDatas: LendingVaultDatas = await this.volumeService.tryActionOrFallbackToVolume<LendingVaultDatas>({
            name: lendingVolumeName,
            action: async () => {
                const reserves = solendMarket.reserves
                const jsonReserves = reserves.map<JSONReserve>(reserve => ({
                    config: reserve.config,
                    stats: reserve.stats ?? undefined,
                    totalBorrowAPY: reserve.totalBorrowAPY(),
                    totalSupplyAPY: reserve.totalSupplyAPY(),
                }))
                const metricsHistories = await this.solendApiService.getHistoricalInterestRates(
                    {
                        ids: jsonReserves.map(reserve => reserve.config.address.toString()),
                        span: "1d",
                    }
                )
                const lendingVaults = jsonReserves.map<LendingVault>(reserve => ({
                    address: reserve.config.address,
                    reserve: reserve,
                    metricsHistory: metricsHistories[reserve.config.address],
                    strategyAnalysis:  (() => {
                        const apySamples: Array<Point> = metricsHistories[reserve.config.address].map(metricsHistory => ({
                            x: dayjs(metricsHistory.timestamp).unix(),
                            y: Number(metricsHistory.supplyAPY),
                        }))
                        const apyRegression = this.regressionService.computeRegression(apySamples)
                        const aprSamples: Array<Point> = metricsHistories[reserve.config.address].map(metricsHistory => ({
                            x: dayjs(metricsHistory.timestamp).unix(),
                            y: Number(metricsHistory.borrowAPY),
                        }))
                        const aprRegression = this.regressionService.computeRegression(aprSamples)
                        const cTokenExchangeRateSamples: Array<Point> = metricsHistories[reserve.config.address].map(metricsHistory => ({
                            x: dayjs(metricsHistory.timestamp).unix(),
                            y: Number(metricsHistory.cTokenExchangeRate),
                        }))
                        const cTokenExchangeRateRegression = this.regressionService.computeRegression(cTokenExchangeRateSamples)
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
                    })()
                }))
                return {
                    market: marketToLoad,
                    lendingVaults,
                }
            },
        })

        await this.cacheManager.set(lendingCacheKey, lendingVaultDatas)
        this.currentIndex[network] += 1
        await this.volumeService.updateJsonFromDataVolume<MarketExtends>(this.getVolumeKey(network), (prevData) => {
            prevData.currentIndex = this.currentIndex[network]
            return prevData
        })
        this.logger.debug(`Updated lending ${marketToLoad.address} (${network}) from API`)
    }
}
