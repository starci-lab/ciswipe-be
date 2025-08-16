import { Injectable, Logger, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { ChainKey, Network } from "@/modules/common"
import { createCacheKey } from "@/modules/cache"
import { RaydiumIndexerService } from "./raydium-indexer.service"
import { GlobalData, RaydiumLevelService } from "./raydium-level.service"
import { TokenUtilsService } from "@/modules/blockchain/tokens"

@Injectable()
export class RaydiumInitService {
    private logger = new Logger(RaydiumInitService.name)

    constructor(
        private readonly levelService: RaydiumLevelService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly indexerService: RaydiumIndexerService,
        private readonly tokenUtilsService: TokenUtilsService,
    ) { }

    public getPoolBatchCacheKey(network: Network, token1: string, token2: string) {
        [token1, token2] = this.tokenUtilsService.ensureTokensOrderById(token1, token2)
        return createCacheKey("pool-batch", {
            network,
            token1,
            token2,
        })
    }

    public getPoolLinesCacheKey(network: Network, poolId: string) {
        return createCacheKey("pool-lines", {
            network,
            poolId,
        })
    }

    public getPoolBatchVolumeKey(network: Network, token1: string, token2: string) {
        [token1, token2] = this.tokenUtilsService.ensureTokensOrderById(token1, token2)
        return `pool-batch-${network}-${token1}-${token2}.json`
    }

    public getPoolLinesVolumeKey(network: Network, poolId: string) {
        return `pool-lines-${network}-${poolId}.json`
    }

    public getGlobalDataVolumeKey(network: Network) {
        return `global-data-${network}.json`
    }

    private async loadAndCachePoolBatch(
        network: Network,
        currentBatchIndex: number,
    ) {
        const [token1, token2] = this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)[currentBatchIndex]
        const poolBatch = await this.levelService.getPoolBatch(network, currentBatchIndex)
        if (!poolBatch) return null
        await this.cacheManager.set(
            this.getPoolBatchCacheKey(network, token1.id, token2.id),
            poolBatch
        )
        // update the indexer
        this.indexerService.setV3PoolBatchAndCurrentLineIndex(network, currentBatchIndex, poolBatch)
        return poolBatch
    }

    private async loadAndCachePoolLines(network: Network, poolId: string) {
        if (!poolId) return
        const poolLines = await this.levelService.getPoolLines(network, poolId)
        if (!poolLines) return
        await this.cacheManager.set(
            this.getPoolLinesCacheKey(network, poolId),
            poolLines
        )
    }

    async cacheAllOnInit() {
        try {
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
                this.logger.fatal(`Initialized batches for ${network}: ${this.indexerService.getInitializedBatches(network)}`)
            }
        } catch (error) {
            this.logger.error(`Cannot cache all on init, maybe some IO-reading failed, we try to reload everything, message: ${error.message}`)
        }
    }

    async loadGlobalData(network: Network,) {
        const defaultGlobalData: GlobalData = {
            currentIndex: 0,
        }
        try {
            const globalData = await this.levelService.getGlobalData(network)
            if (!globalData) return defaultGlobalData
            this.indexerService.setCurrentIndex(network, globalData.currentIndex)
        } catch (error) {
            this.logger.error(`Cannot load global data for ${network}, message: ${error.message}`)
            return defaultGlobalData
        }
    }
}
