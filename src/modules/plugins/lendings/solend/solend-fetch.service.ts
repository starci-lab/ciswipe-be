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
    Market,
    HistoricalInterestRatesResponse
} from "./solend-api.service"
import { ReserveConfigType, SolendMarket, ReserveDataType, SolendReserve } from "@solendprotocol/solend-sdk"
import { Cron, CronExpression } from "@nestjs/schedule"
import { sleep } from "@/modules/common"
import { createCacheKey } from "@/modules/cache"

export interface LendingRaw {
    address: Address | undefined;
}

export interface JSONReserve {
    config: ReserveConfigType
    stats?: ReserveDataType
    totalBorrowAPY: ReturnType<SolendReserve["totalBorrowAPY"]>
    totalSupplyAPY: ReturnType<SolendReserve["totalSupplyAPY"]>
}

export interface LendingVault {
    address: string
    reserve: JSONReserve
    metricsHistory: Array<HistoricalInterestRateItem>
    strategyAnalysis: StrategyAnalysis
}

export interface LendingVaultsData {
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

    private async cacheAllOnInit() {
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue

            // we do first with vaults
            const marketsVolumeName = this.getMarketsVolumeKey(network)
            if (await this.volumeService.existsInDataVolume(marketsVolumeName)) {
                const markets = await this.volumeService.readJsonFromDataVolume<MarketExtends>(marketsVolumeName)
                this.cacheManager.set(this.getMarketsCacheKey(network), markets)
                // then we do iter for vaults
                for (const market of markets.markets) {
                    if (!market.address) continue
                    const lendingVaultsVolumeName = this.getLendingVaultsVolumeKey(network, market.address?.toString() || "")
                    if (await this.volumeService.existsInDataVolume(lendingVaultsVolumeName)) {
                        const lendingVaults = await this.volumeService.readJsonFromDataVolume<LendingVaultsData>(lendingVaultsVolumeName)
                        this.cacheManager.set(this.getLendingVaultsCacheKey(network, market.address.toString()), lendingVaults)
                    }
                }
            }
        }
    }

    async onModuleInit() {
        await this.cacheAllOnInit()
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

    public getLendingVaultsCacheKey(network: Network, marketAddress: string) {
        return createCacheKey("solend-lending-lending-vaults", {
            network,
            marketAddress,
        })
    }

    public getMarketsCacheKey(network: Network) {
        return createCacheKey("solend-lending-markets", {
            network,
        })
    }

    private getMarketsVolumeKey(network: Network) {
        return `solend-lending-markets-${network}.json`
    }

    private getLendingVaultsVolumeKey(network: Network, marketAddress: string) {
        return `solend-lending-lending-vaults-${network}-${marketAddress}.json`
    }

    async loadMarkets(network: Network) {
        if (network === Network.Testnet) return
        const marketsVolumeKey = this.getMarketsVolumeKey(network)
        const marketCacheKey = this.getMarketsCacheKey(network)
        const marketsRaw = await this.volumeService.tryActionOrFallbackToVolume<
            MarketExtends
        >({
            name: marketsVolumeKey,
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
        const lendingVaultsCacheKey = this.getLendingVaultsCacheKey(network, marketToLoad.address)
        const lendingVaultsVolumeName = this.getLendingVaultsVolumeKey(network, marketToLoad.address)

        const lendingVaultDatas: LendingVaultsData = await this.volumeService.tryActionOrFallbackToVolume<LendingVaultsData>({
            name: lendingVaultsVolumeName,
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
                    strategyAnalysis: this.computeRegression(metricsHistories, reserve),
                }))
                return {
                    market: marketToLoad,
                    lendingVaults,
                }
            },
        })

        await this.cacheManager.set(lendingVaultsCacheKey, lendingVaultDatas)
        this.currentIndex[network] += 1
        await this.volumeService.updateJsonFromDataVolume<MarketExtends>(this.getMarketsVolumeKey(network), (prevData) => {
            prevData.currentIndex = this.currentIndex[network]
            return prevData
        })
        this.logger.debug(`Updated lending ${marketToLoad.address} (${network}) from API`)
    }

    private computeRegression(metricsHistories: HistoricalInterestRatesResponse, reserve: JSONReserve) {
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
    }
}
