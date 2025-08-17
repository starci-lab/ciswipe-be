
import { Injectable, Logger } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import { RaydiumDexIndexerService } from "./raydium-indexer.service"
import { GlobalData, RaydiumDexLevelService } from "./raydium-level.service"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { RaydiumDexCacheService } from "./raydium-cache.service"
import { RetryService } from "@/modules/misc"

@Injectable()
export class RaydiumDexInitService {
    private logger = new Logger(RaydiumDexInitService.name)

    constructor(
        private readonly raydiumDexLevelService: RaydiumDexLevelService,
        private readonly raydiumDexIndexerService: RaydiumDexIndexerService,
        private readonly tokenUtilsService: TokenUtilsService,
        private readonly raydiumDexCacheService: RaydiumDexCacheService,
        private readonly retryService: RetryService,
    ) { }

    private async loadAndCachePoolBatch(
        network: Network,
        currentBatchIndex: number,
    ) {
        const poolBatch = await this.raydiumDexLevelService.getPoolBatch(network, currentBatchIndex)
        if (!poolBatch) return null
        await this.raydiumDexCacheService.cachePoolBatch(network, currentBatchIndex, poolBatch)
        // update the indexer
        this.raydiumDexIndexerService.setV3PoolBatchAndCurrentLineIndex(network, currentBatchIndex, poolBatch)
        return poolBatch
    }

    private async loadAndCachePoolLines(network: Network, poolId: string) {
        if (!poolId) return
        const poolLines = await this.raydiumDexLevelService.getPoolLines(network, poolId)
        if (!poolLines) return
        await this.raydiumDexCacheService.cachePoolLines(network, poolId, poolLines)
    }

    async loadAndCacheAllOnInit() {
        await this.retryService.retry(
            {
                action:     
            async () => {
                for (const network of Object.values(Network)) {
                    if (network === Network.Testnet) continue
                    const pairs = this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)
                    const promises: Array<Promise<void>> = []
                    for (let currentBatchIndex = 0; currentBatchIndex < pairs.length; currentBatchIndex++) {
                        promises.push(
                            (async () => {
                                const poolBatch = await this.loadAndCachePoolBatch(network, currentBatchIndex)
                                if (!poolBatch?.pools) return
                                const internalPromises: Array<Promise<void>> = []
                                for (const pool of poolBatch.pools) {
                                    internalPromises.push(
                                        this.loadAndCachePoolLines(network, pool.pool.id)
                                    )
                                }
                                await Promise.all(internalPromises)
                            })()
                        )
                    }
                    await Promise.all(promises)
                    this.logger.fatal(`Initialized batches for ${network}: ${this.raydiumDexIndexerService.getInitializedBatches(network)}`)
                }
            },
            }
        )

    }

    async loadGlobalData(network: Network,) {
        const defaultGlobalData: GlobalData = {
            currentIndex: 0,
        }
        try {
            const globalData = await this.raydiumDexLevelService.getGlobalData(network)
            if (!globalData) return defaultGlobalData
            this.raydiumDexIndexerService.setCurrentIndex(network, globalData.currentIndex)
        } catch (error) {
            this.logger.error(`Cannot load global data for ${network}, message: ${error.message}`)
            return defaultGlobalData
        }
    }
}
