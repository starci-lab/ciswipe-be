import { Injectable, Logger } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import { RaydiumIndexerService } from "./raydium-indexer.service"
import { GlobalData, RaydiumLevelService } from "./raydium-level.service"
import { TokenUtilsService } from "@/modules/blockchain/tokens"

@Injectable()
export class RaydiumInitService {
    private logger = new Logger(RaydiumInitService.name)

    constructor(
    private readonly levelService: RaydiumLevelService,
    private readonly indexerService: RaydiumIndexerService,
    private readonly tokenUtilsService: TokenUtilsService,
    ) {}

    private async loadPoolBatch(
        network: Network,
        currentBatchIndex: number,
    ) {
        const poolBatch = await this.levelService.getPoolBatch(
            network,
            currentBatchIndex,
        )
        if (!poolBatch) return null
        // update the indexer
        this.indexerService.setV3PoolBatchAndCurrentLineIndex(
            network,
            currentBatchIndex,
            poolBatch,
        )
        return poolBatch
    }

    private async loadPoolLines(network: Network, poolId: string) {
        if (!poolId) return
        const poolLines = await this.levelService.getPoolLines(network, poolId)
        if (!poolLines) return
    }

    async loadAllOnInit() {
        try {
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
                            const poolBatch = await this.loadPoolBatch(
                                network,
                                currentBatchIndex,
                            )
                            if (!poolBatch?.pools) return
                            const internalPromises: Array<Promise<void>> = []
                            for (const pool of poolBatch.pools) {
                                internalPromises.push(
                                    this.loadPoolLines(network, pool.pool.id),
                                )
                            }
                            await Promise.all(internalPromises)
                        })(),
                    )
                }
                await Promise.all(promises)
                this.logger.fatal(
                    `Initialized batches for ${network}: ${this.indexerService.getInitializedBatches(network)}`,
                )
            }
        } catch (error) {
            this.logger.error(
                `Cannot cache all on init, maybe some IO-reading failed, we try to reload everything, message: ${error.message}`,
            )
        }
    }

    async loadGlobalData(network: Network) {
        const defaultGlobalData: GlobalData = {
            currentIndex: 0,
        }
        try {
            const globalData = await this.levelService.getGlobalData(network)
            if (!globalData) return defaultGlobalData
            this.indexerService.setCurrentIndex(network, globalData.currentIndex)
        } catch (error) {
            this.logger.error(
                `Cannot load global data for ${network}, message: ${error.message}`,
            )
            return defaultGlobalData
        }
    }
}
