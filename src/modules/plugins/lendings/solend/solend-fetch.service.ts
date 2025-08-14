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
    Market,
    SolendLendingApiService,
} from "./solend-api.service"
import { Cron, CronExpression } from "@nestjs/schedule"
import { createCacheKey } from "@/modules/cache"
import { SolendRpcService, WithAddressAndStats } from "./solend-rpc.service"
import { Reserve } from "./schema"
import { randomUUID } from "crypto"

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

const DAY = 60 * 60 * 24
const FOLDER_NAMES = ["lendings", "solend"]
@Injectable()
export class SolendLendingFetchService implements OnModuleInit {
    private logger = new Logger(SolendLendingFetchService.name)
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }
    private reserves: Record<Network, Array<WithAddressAndStats<Reserve>>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }
    constructor(
    private readonly volumeService: VolumeService,
    private readonly solendApiService: SolendLendingApiService,
    private readonly solendRpcService: SolendRpcService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly regressionService: RegressionService,
    ) {}

    private async cacheAllOnInit() {
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue
            const lendingPoolsVolumeName = this.getLendingPoolsVolumeKey(network)
            if (
                await this.volumeService.existsInDataVolume({
                    name: lendingPoolsVolumeName,
                })
            ) {
                const lendingPools = await this.volumeService.readJsonFromDataVolume<
          Array<LendingPool>
        >({ name: lendingPoolsVolumeName })
                this.cacheManager.set(
                    this.getLendingPoolsCacheKey(network),
                    lendingPools,
                )
                const reserves = lendingPools.map((pool) => pool.reserves).flat()
                // thus, load metadata for each reserves
                const promises: Array<Promise<void>> = []
                for (const reserve of reserves) {
                    promises.push(
                        (async () => {
                            if (
                                await this.volumeService.existsInDataVolume({
                                    name: this.getReserveMetadataCacheKey(
                                        network,
                                        reserve.reserve.address,
                                    ),
                                    folderNames: FOLDER_NAMES,
                                })
                            ) {
                                this.cacheManager.set(
                                    this.getReserveMetadataCacheKey(
                                        network,
                                        reserve.reserve.address,
                                    ),
                                    await this.volumeService.readJsonFromDataVolume<LendingReserveMetadata>(
                                        {
                                            name: this.getReserveMetadataCacheKey(
                                                network,
                                                reserve.reserve.address,
                                            ),
                                            folderNames: FOLDER_NAMES,
                                        },
                                    ),
                                )
                            }
                        })(),
                    )
                }
                await Promise.all(promises)
            }
        }
    }

    async onModuleInit() {
        await this.cacheAllOnInit()
        await this.handleLoadLendingPools()
    }

  // Load lending pools each week
  @Cron(CronExpression.EVERY_WEEK)
    async handleLoadLendingPools() {
        for (const network of Object.values(Network)) {
            await this.loadLendingPools(network)
        }
    }

  public getLendingPoolsCacheKey(network: Network) {
      return createCacheKey("lending-pools", {
          network,
      })
  }

  private getLendingPoolsVolumeKey(network: Network) {
      return `lending-pools-${network}.json`
  }

  public getReserveMetadataCacheKey(network: Network, reserveId: string) {
      return createCacheKey("solend-historical-interest-rates", {
          network,
          reserveId,
      })
  }

  public getReserveMetadataVolumeKey(network: Network, reserveId: string) {
      return `historical-interest-rates-${network}-${reserveId}.json`
  }

  @Cron(CronExpression.EVERY_SECOND)
  async handleLoadReserveMetadata() {
      for (const network of Object.values(Network)) {
          await this.loadReserveMetadata(network)
      }
  }

  async loadReserveMetadata(network: Network) {
      if (network === Network.Testnet) return
      if (!this.reserves[network]?.length) {
          this.logger.verbose(`No reserves to load for ${network}`)
          return
      }
      if (typeof this.currentIndex[network] === "undefined") {
          this.currentIndex[network] = 0
      }
      if (
          this.currentIndex[network] >= this.reserves[network].length
      ) {
          this.logger.verbose(`No more reserves to load for ${network}`)
          return
      }
      const reserve = this.reserves[network][this.currentIndex[network]]
      const reserveMetadataVolumeKey = this.getReserveMetadataVolumeKey(
          network,
          reserve.address,
      )
      const metadata =
      await this.volumeService.tryActionOrFallbackToVolume<LendingReserveMetadata>(
          {
              name: reserveMetadataVolumeKey,
              action: async (): Promise<LendingReserveMetadata> => {
                  const results =
              await this.solendApiService.getHistoricalInterestRates({
                  ids: [reserve.address],
                  span: "1d",
              })
                  if (!results) {
                      throw new Error(`No results found with id ${reserve.address}`)
                  }
                  const strategyAnalysis = this.computeRegression(results, reserve.address)
                  return {
                      metricsHistory: results[reserve.address],
                      strategyAnalysis: strategyAnalysis,
                  }
              },
              folderNames: FOLDER_NAMES,
          },
      )
      // store in cache
      this.cacheManager.set(
          this.getReserveMetadataCacheKey(network, reserve.address),
          metadata,
      )
      // plus to next reserve
      this.currentIndex[network]++
      // update the original data
      await this.volumeService.updateJsonFromDataVolume<PoolsData>({
          name: this.getLendingPoolsVolumeKey(network),
          updateFn: (prevData) => {
              prevData.currentIndex = this.currentIndex[network]
              return prevData
          },
          folderNames: FOLDER_NAMES,
      })
      this.logger.verbose(
          `Loaded historical interest rates for ${network} reserve ${reserve.address}`,
      )
  }

  async loadLendingPools(network: Network) {
      if (network === Network.Testnet) return
      const lendingPoolsVolumeKey = this.getLendingPoolsVolumeKey(network)
      const lendingPoolsRaw =
      await this.volumeService.tryActionOrFallbackToVolume<PoolsData>({
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
                          (reserve) =>
                              reserve.data.lendingMarket.toBase58() === market.address,
                      )
                      .map<LendingReserve>((reserve) => ({
                          reserve: reserve,
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
      this.currentIndex[network] = lendingPoolsRaw.currentIndex
      this.reserves[network] = lendingPoolsRaw.pools
          .map((pool) => pool.reserves)
          .flat()
          .map((reserve) => reserve.reserve)
      console.log(this.reserves[network])
      await this.cacheManager.set(
          this.getLendingPoolsCacheKey(network),
          lendingPoolsRaw,
      )
      this.logger.verbose(
          `Loaded ${lendingPoolsRaw.pools.length} pools for ${network} from API or volume fallback.`,
      )
  }

  private computeRegression(
      metricsHistories: HistoricalInterestRatesResponse,
      reserveId: string,
  ) {
      const apySamples: Array<Point> = metricsHistories[reserveId].map((metricsHistory) => ({
          x: dayjs(metricsHistory.timestamp).unix(),
          y: Number(metricsHistory.supplyAPY),
      }))
      const apyRegression = this.regressionService.computeRegression(apySamples)
      const aprSamples: Array<Point> = metricsHistories[reserveId].map((metricsHistory) => ({
          x: dayjs(metricsHistory.timestamp).unix(),
          y: Number(metricsHistory.borrowAPY),
      }))
      const aprRegression = this.regressionService.computeRegression(aprSamples)
      const cTokenExchangeRateSamples: Array<Point> = metricsHistories[reserveId].map(
          (metricsHistory) => ({
              x: dayjs(metricsHistory.timestamp).unix(),
              y: Number(metricsHistory.cTokenExchangeRate),
          }),
      )
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
