import { Injectable, Logger } from "@nestjs/common"
import { ChainKey, Network, sleep } from "@/modules/common"
import {
    tokenPairs,
} from "@/modules/blockchain"
import { Cron, CronExpression } from "@nestjs/schedule"
import { LockService, RetryService } from "@/modules/misc"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { OrcaDexIndexerService } from "./orca-indexer.service"
import { OrcaDexApiService, OrcaWhirlpool } from "./orca-api.service"
import { OrcaDexDataService, PoolBatch } from "./orca-data.service"
import { OrcaDexCacheService } from "./orca-cache.service"

const LOCK_KEYS = {
    POOL_BATCH: "ORCA_DEX_POOL_BATCH",
}

@Injectable()
export class OrcaDexFetchService {
    private logger = new Logger(OrcaDexFetchService.name)

    constructor(
        private readonly orcaDexIndexerService: OrcaDexIndexerService,
        private readonly orcaDexApiService: OrcaDexApiService,
        private readonly lockService: LockService,
        private readonly tokenUtilsService: TokenUtilsService,
        private readonly retryService: RetryService,
        private readonly orcaDexCacheService: OrcaDexCacheService,
        private readonly orcaDexDataService: OrcaDexDataService,
    ) { }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async handleLoadPoolBatch() {
        await this.retryService.retry({
            action: async () => {
                for (const network of Object.values(Network)) {
                    await this.loadPoolBatch(network)
                }
            },
        })
    }

    // load pool batch
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
                // now we try to get the current index that was reseted
                const currentIndex = this.orcaDexIndexerService.getCurrentIndex(network)
                if (this.tokenUtilsService.checkEveryPairsLoaded(ChainKey.Solana, network, currentIndex)) {
                    this.logger.verbose(`Every pairs are loaded for ${network}, current index: ${currentIndex}`)
                    return
                }
                const [token0, token1] =
                    this.tokenUtilsService.getPairsWithoutNativeToken(
                        ChainKey.Solana,
                        network,
                    )[currentIndex]
                try {
                    // raydium only support Solana, so that we dont care about ChainKey
                    const poolBatch = await this.orcaDexDataService.getPoolBatch(
                        network,
                        currentIndex,
                        async () => {
                            if (!token0.tokenAddress || !token1.tokenAddress) {
                                this.logger.error(`Token address is not found for ${token0.id} and ${token1.id}`)
                                return null
                            }
                            const pools: Array<OrcaWhirlpool> = []
                            let next: string | undefined | null = undefined
                            try {
                                while (next !== null) {
                                    const { data, meta: { next: _next } } =
                                await this.orcaDexApiService.listWhirlpools({
                                    tokensBothOf: [token0.tokenAddress, token1.tokenAddress],
                                    next
                                })
                                    if (!data || data.length === 0) break
                                    pools.push(...data)
                                    next = _next ?? null
                                    if (next) {
                                        this.logger.debug(
                                            `Found more pools for ${token0.id}-${token1.id}. Sleeping 1s to avoid rate limit...`,
                                        )
                                        await sleep(1000)
                                    }
                                }
                      
                                const batch: PoolBatch = {
                                    pools: pools.map(pool => ({ pool })), // PoolData { pool: OrcaWhirlpool }
                                }
                                await this.orcaDexCacheService.cachePoolBatch(network, currentIndex, batch)
                                return batch
                            } catch (error) {
                                this.logger.error(
                                    `Cannot load pool batch for ${token0.id}-${token1.id}, message: ${error?.message ?? error}`,
                                )
                                return null
                            }
                        },
                    )
                    if (!poolBatch) {
                        this.logger.error(
                            `Cannot load pool batch for ${token0.id} and ${token1.id}, message: Pool batch is not found`,
                        )
                        return
                    }
                    // update the indexer
                    this.orcaDexIndexerService.setV3PoolBatch(
                        network,
                        currentIndex,
                        poolBatch.pools.map((pool) => pool.pool),
                    )
                    // cache the pool batch
                    await this.orcaDexCacheService.cachePoolBatch(
                        network,
                        currentIndex,
                        poolBatch,
                    )
                    // log the pool batch
                    this.logger.debug(
                        `Loaded pool batch for 
                      ${token0.id} 
                      and 
                      ${token1.id}, 
                      index: ${currentIndex}, 
                      total pools: ${poolBatch.pools.length},
                      total pairs: ${tokenPairs[ChainKey.Solana][network].length},
                      total v3 pool batches: ${this.orcaDexIndexerService.getV3PoolBatches(network)[currentIndex]?.length}
                      `,
                    )
                } catch (error) {
                    this.logger.error(
                        `Cannot load pool batch for ${token0.id} and ${token1.id}, message: ${error.message}`,
                    )
                } finally {
                    await this.retryService.retry({
                        action: async () => {
                            // update the global data
                            this.orcaDexIndexerService.nextCurrentIndex(network)
                            await this.orcaDexDataService.increaseCurrentIndex(network)
                        }
                    })
                }
            },
        })
    }
}
