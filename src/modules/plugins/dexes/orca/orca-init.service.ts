import { Injectable, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network, PluginProtocolName } from "@/modules/common"
import { OrcaDexIndexerService } from "./orca-indexer.service"
import { OrcaDexDataService } from "./orca-data.service"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { OrcaDexCacheService } from "./orca-cache.service"
import { RetryService } from "@/modules/misc"
import { InjectWinstonLogging } from "@/modules/loki"
import { Logger } from "winston"

@Injectable()
export class OrcaDexInitService implements OnModuleInit {
    private readonly context = OrcaDexInitService.name
    private readonly protocolName = PluginProtocolName.DexOrca
    private readonly chain = ChainKey.Solana

    constructor(
    private readonly orcaDexDataService: OrcaDexDataService,
    private readonly orcaDexIndexerService: OrcaDexIndexerService,
    private readonly tokenUtilsService: TokenUtilsService,
    private readonly orcaDexCacheService: OrcaDexCacheService,
    private readonly retryService: RetryService,
    @InjectWinstonLogging()
    private readonly logger: Logger,
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
                    this.logger.info(
                        "InitializedBatches",
                        {
                            context: this.context,
                            protocolName: this.protocolName,
                            chain: this.chain,
                            network,
                            initializedBatches: this.orcaDexIndexerService.getInitializedBatches(network),
                        },
                    )
                }
            },
        })
    }

    async loadGlobalData(network: Network) {
        try {
            const globalData =
        await this.orcaDexDataService.getGlobalData(network)
            if (!globalData) {
                await this.orcaDexDataService.initGlobalData(network)
                return 
            }
            this.orcaDexIndexerService.setCurrentIndex(
                network,
                globalData.currentIndex,
            )
        } catch (error) {
            this.logger.error(
                "LoadGlobalDataFailed",
                {
                    context: this.context,
                    protocolName: this.protocolName,
                    chain: this.chain,
                    network,
                    error: error?.message,
                    stack: error?.stack,
                },
            )
            return
        }
    }
}
