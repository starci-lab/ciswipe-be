import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network, sleep } from "@/modules/common"
import {
    createProviderToken,
    RecordRpcProvider,
    tokenPairs,
} from "@/modules/blockchain"
import { Connection } from "@solana/web3.js"
import { Raydium, ApiV3PoolInfoItem } from "@raydium-io/raydium-sdk-v2"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { VolumeService } from "@/modules/volume"
import { Cron, CronExpression } from "@nestjs/schedule"
import { RaydiumInitService } from "./raydium-init.service"
import {
    RaydiumIndexerService,
    PoolBatch,
    PoolLines,
    GlobalData,
} from "./raydium-indexer.service"
import { LockService } from "@/modules/misc"
import { FOLDER_NAMES } from "./constants"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { RaydiumApiService } from "./raydium-api.service"

const LOCK_KEYS = {
    POOL_BATCH: "poolBatch",
    POOL_LINES: "poolLines",
}

@Injectable()
export class RaydiumFetchService implements OnModuleInit {
    private logger = new Logger(RaydiumFetchService.name)
    private raydiums: Record<Network, Raydium>

    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly initService: RaydiumInitService,
    private readonly volumeService: VolumeService,
    private readonly indexerService: RaydiumIndexerService,
    private readonly lockService: LockService,
    private readonly tokenUtilsService: TokenUtilsService,
    private readonly raydiumApiService: RaydiumApiService,
    ) {}

    private ensureTokensOrder(token1: string, token2: string) {
        if (Buffer.byteLength(token1) > Buffer.byteLength(token2)) {
            [token1, token2] = [token2, token1]
        }
        return [token1, token2]
    }

    async onModuleInit() {
        for (const network of Object.values(Network)) {
            await this.initService.loadGlobalData(network)
        }
        // 2. Cache all on init
        await this.initService.cacheAllOnInit()
        // 3. Load raydium
        const _raydiums: Partial<Record<Network, Raydium>> = {}
        for (const network of Object.values(Network)) {
            _raydiums[network] = await Raydium.load({
                connection: this.solanaRpcProvider[network],
            })
        }
        // we have to cast type to Record<Network, Raydium> to avoid compilation error
        this.raydiums = _raydiums as Record<Network, Raydium>
    }

  @Cron(CronExpression.EVERY_5_SECONDS)
    async handleLoadPoolBatch() {
        for (const network of Object.values(Network)) {
            await this.loadPoolBatch(network)
        }
    }

  @Cron("*/3 * * * * *")
  async handleLoadLines() {
      for (const network of Object.values(Network)) {
          await this.loadLines(network)
      }
  }

  public async loadPoolBatch(network: Network) {
      await this.lockService.withLocks({
          blockedKeys: [LOCK_KEYS.POOL_BATCH],
          acquiredKeys: [LOCK_KEYS.POOL_BATCH],
          releaseKeys: [LOCK_KEYS.POOL_BATCH],
          network,
          callback: async () => {
              if (network === Network.Testnet) {
                  return
              }
              // if the first pair is not loaded, we will return
              // if we load end the pairs, we will return to the start index
              if (
                  this.indexerService.getCurrentIndex(network) >=
          tokenPairs[ChainKey.Solana][network].length
              ) {
                  this.indexerService.setCurrentIndex(network, 0)
              }
              // now we try to get the current index that was reseted
              const currentIndex = this.indexerService.getCurrentIndex(network)
              const [unsoredToken1, unsoredToken2] =
          this.tokenUtilsService.tryGetWrappedTokens({
              tokens: tokenPairs[ChainKey.Solana][network][currentIndex],
              network,
              chainKey: ChainKey.Solana,
          })
              if (!unsoredToken1.tokenAddress || !unsoredToken2.tokenAddress) {
                  throw new Error(
                      `Token address is not found for ${unsoredToken1.id} and ${unsoredToken2.id}`,
                  )
              }

              const [token1, token2] = this.tokenUtilsService.ensureTokensOrder(
                  unsoredToken1,
                  unsoredToken2,
              )
              try {
                  if (token1.tokenAddress === token2.tokenAddress) {
                      this.logger.debug(
                          `Skipping the same token pair ${token1.id} and ${token2.id}`,
                      )
                      return
                  }
                  // raydium only support Solana, so that we dont care about ChainKey
                  const raydium = this.raydiums[network]
                  const poolBatch =
            await this.volumeService.tryActionOrFallbackToVolume<PoolBatch>({
                name: this.initService.getPoolBatchVolumeKey(
                    network,
                    token1.id,
                    token2.id,
                ),
                action: async () => {
                    const pools: Array<ApiV3PoolInfoItem> = []
                    let nextPageAvailable = true
                    while (nextPageAvailable) {
                        if (!token1.tokenAddress || !token2.tokenAddress) {
                            throw new Error(
                                `Token address is not found for ${token1.id} and ${token2.id}`,
                            )
                        }
                        const { data, hasNextPage } =
                    await raydium.api.fetchPoolByMints({
                        mint1: token1.tokenAddress,
                        mint2: token2.tokenAddress,
                    })
                        pools.push(...data)
                        nextPageAvailable = hasNextPage
                        if (hasNextPage) {
                            this.logger.debug(
                                `We found more pools for ${token1.id} and ${token2.id}, so we will sleep for 1 second to avoid rate limit`,
                            )
                            await sleep(1000)
                        }
                    }
                    return {
                        pools,
                        currentLineIndex: 0,
                    }
                },
                folderNames: FOLDER_NAMES,
            })
                  this.indexerService.setV3PoolBatch(
                      network,
                      currentIndex,
                      poolBatch.pools,
                  )
                  this.indexerService.setCurrentLineIndex(
                      network,
                      currentIndex,
                      poolBatch.currentLineIndex,
                  )
                  // cache the pool batch
                  await this.cacheManager.set(
                      this.initService.getPoolBatchCacheKey(
                          network,
                          token1.id,
                          token2.id,
                      ),
                      poolBatch,
                  )
                  // update the indexer
                  this.indexerService.setV3PoolBatch(
                      network,
                      currentIndex,
                      poolBatch.pools,
                  )
                  // load the batch
                  this.logger.debug(
                      `Loaded pool batch for ${token1.id} and ${token2.id}, index: ${currentIndex}, total: ${poolBatch.pools.length - 1}`,
                  )
              } catch (error) {
                  this.logger.error(
                      `Cannot load pool batch for ${token1.id} and ${token2.id}, message: ${error.message}`,
                  )
              } finally {
                  // we will increase the index to the next pair
                  this.indexerService.nextIndex(network)
                  // update the volume
                  await this.volumeService.updateJsonFromDataVolume<GlobalData>({
                      name: this.initService.getGlobalDataVolumeKey(network),
                      updateFn: (prevData) => {
                          prevData.currentIndex =
                this.indexerService.getCurrentIndex(network)
                          return prevData
                      },
                      folderNames: FOLDER_NAMES,
                  })
              }
          },
      })
  }

  // return true if we have loaded all lines for the current index, otherwise not
  public async loadLines(network: Network) {
      await this.lockService.withLocks({
          blockedKeys: [LOCK_KEYS.POOL_LINES, LOCK_KEYS.POOL_BATCH],
          acquiredKeys: [LOCK_KEYS.POOL_LINES],
          // no authorized to release batch
          releaseKeys: [LOCK_KEYS.POOL_LINES],
          network,
          callback: async () => {
              const pair = this.indexerService.findNextUnloadedLineIndex(network)
              if (!pair) {
                  // we already loaded all lines for the current index
                  return
              }
              const [batchIndex, lineIndex] = pair
              const pool = this.indexerService.getV3PoolBatch(network, batchIndex)[
                  lineIndex
              ]
              try {
                  const poolLines =
            await this.volumeService.tryActionOrFallbackToVolume<PoolLines>({
                name: this.initService.getPoolLinesVolumeKey(network, pool.id),
                action: async () => {
                    const liquidityLines =
                  await this.raydiumApiService.fetchPoolLines(pool.id)
                    // sleep 1000s to avoid rate limit
                    await sleep(1000)
                    const positionLines =
                  await this.raydiumApiService.fetchPoolPositions(pool.id)
                    return {
                        poolId: pool.id,
                        liquidityLines,
                        positionLines,
                    }
                },
                folderNames: FOLDER_NAMES,
            })

                  await this.cacheManager.set(
                      this.initService.getPoolLinesCacheKey(network, pool.id),
                      poolLines,
                  )
                  this.logger.verbose(
                      `Loaded pool lines for ${pool.id}, pair: ${tokenPairs[ChainKey.Solana][network][this.indexerService.getCurrentIndex(network)][0].id} ${tokenPairs[ChainKey.Solana][network][this.indexerService.getCurrentIndex(network)][1].id}, index: ${lineIndex + 1}, total: ${this.indexerService.getV3PoolBatch(network, batchIndex).length}`,
                  )
              } catch (error) {
                  this.logger.error(
                      `Cannot load pool lines for ${pool.id}, message: ${error.message}`,
                  )
              } finally {
                  this.indexerService.nextLineIndex(network, batchIndex)
                  // update the volume
                  await this.volumeService.updateJsonFromDataVolume<GlobalData>({
                      name: this.initService.getGlobalDataVolumeKey(network),
                      updateFn: (prevData) => {
                          prevData.currentIndex =
                this.indexerService.getCurrentIndex(network)
                          return prevData
                      },
                      folderNames: FOLDER_NAMES,
                  })
              }
          },
      })
  }
}
