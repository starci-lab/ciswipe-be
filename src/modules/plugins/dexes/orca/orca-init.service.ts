import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import { OrcaDexIndexerService } from "./orca-indexer.service"
import { GlobalData, OrcaDexDataService } from "./orca-data.service"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { OrcaDexCacheService } from "./orca-cache.service"
import { RetryService } from "@/modules/misc"

@Injectable()
export class OrcaDexInitService implements OnModuleInit {
    private logger = new Logger(OrcaDexInitService.name)

    constructor(
    private readonly orcaDexDataService: OrcaDexDataService,
    private readonly orcaDexIndexerService: OrcaDexIndexerService,
    private readonly tokenUtilsService: TokenUtilsService,
    private readonly orcaDexCacheService: OrcaDexCacheService,
    private readonly retryService: RetryService,
    ) {}

    async onModuleInit() {
        for (const network of Object.values(Network)) {
            await this.loadGlobalData(network)
        }
        await this.loadAndCacheAllOnInit()
    }

    private async loadAndCachePoolBatch(
        network: Network,
        currentBatchIndex: number,
    ) {
        const poolBatch = await this.orcaDexDataService.getPoolBatch(
            network,
            currentBatchIndex,
        )
        if (!poolBatch) return null
        await this.orcaDexCacheService.cachePoolBatch(
            network,
            currentBatchIndex,
            poolBatch,
        )
        // update the indexer
        this.orcaDexIndexerService.setV3PoolBatch(
            network,
            currentBatchIndex,
            poolBatch.pools.map((pool) => pool.pool),
        )
        return poolBatch
    }

    async loadAndCacheAllOnInit() {
        await this.retryService.retry({
            action: async () => {
                for (const network of Object.values(Network)) {
                    if (network === Network.Testnet) continue
                    const pairs = this.tokenUtilsService.getPairsWithoutNativeToken(
                        ChainKey.Solana,
                        network,
                    )
                    const promises: Array<Promise<void>> = []
                    for (
                        let currentBatchIndex = 0;
                        currentBatchIndex < pairs.length;
                        currentBatchIndex++
                    ) {
                        promises.push(
                            (async () => {
                                const poolBatch = await this.loadAndCachePoolBatch(
                                    network,
                                    currentBatchIndex,
                                )
                                if (!poolBatch?.pools) return
                            })(),
                        )
                    }
                    await Promise.all(promises)
                    this.logger.fatal(
                        `Initialized batches for ${network}: ${this.orcaDexIndexerService.getInitializedBatches(network)}`,
                    )
                }
            },
        })
    }

    async loadGlobalData(network: Network) {
        const defaultGlobalData: GlobalData = {
            currentIndex: 0,
        }
        try {
            const globalData =
        await this.orcaDexDataService.getGlobalData(network)
            if (!globalData) return defaultGlobalData
            this.orcaDexIndexerService.setCurrentIndex(
                network,
                globalData.currentIndex,
            )
        } catch (error) {
            this.logger.error(
                `Cannot load global data for ${network}, message: ${error.message}`,
            )
            return defaultGlobalData
        }
    }
}
