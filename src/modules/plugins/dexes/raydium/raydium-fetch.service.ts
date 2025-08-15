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
import { RaydiumIndexerService } from "./raydium-indexer.service"
import { 
    RaydiumInitService, 
    PoolBatch, 
    PoolLine, 
    PoolLines 
} from "./raydium-init.service"
import { LockService } from "@/modules/misc"
import { FOLDER_NAMES } from "./constants"

const LOCK_KEYS = {
    POOL: "pool",
    LINE: "line",
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
        private readonly volumeService: VolumeService,
        private readonly indexerService: RaydiumIndexerService,
        private readonly initService: RaydiumInitService,
        private readonly lockService: LockService,
    ) { }



    async onModuleInit() {
        // 1. Load global data and cache all on init
        const currentIndexes: Record<Network, number> = {
            [Network.Mainnet]: 0,
            [Network.Testnet]: 0,
        }
        
        for (const network of Object.values(Network)) {
            const globalData = await this.initService.loadGlobalData(network)
            this.indexerService.setCurrentIndex(network, globalData.currentIndex)
            currentIndexes[network] = globalData.currentIndex
        }
        
        // 2. Cache all on init
        await this.initService.cacheAllOnInit(currentIndexes)
        
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

    @Cron(CronExpression.EVERY_SECOND)
    async handleLoadLines() {
        for (const network of Object.values(Network)) {
            await this.loadLines(network)
        }
    }



    public async loadPoolBatch(network: Network) {
        this.lockService.withLocks([LOCK_KEYS.POOL], network, async () => {
            // if the first pair is not loaded, we will return
            // if we load end the pairs, we will return to the start index
            const currentIndex = this.indexerService.getCurrentIndex(network)
            if (
                typeof currentIndex === "undefined" ||
                currentIndex >= tokenPairs[network][ChainKey.Solana].length
            ) {
                this.indexerService.setCurrentIndex(network, 0)
            }
            const [token1, token2] =
                tokenPairs[network][ChainKey.Solana][currentIndex]
            if (!token1 || !token2) {
                return
            }
            try {
                // raydium only support Solana, so that we dont care about ChainKey
                const raydium = this.raydiums[network]
                const poolBatch =
                    await this.volumeService.tryActionOrFallbackToVolume<PoolBatch>({
                        name: this.initService.getPoolBatchVolumeKey(network, token1.id, token2.id),
                        action: async () => {
                            const pools: Array<ApiV3PoolInfoItem> = []
                            let nextPageAvailable = true
                            while (nextPageAvailable) {
                                const { data, hasNextPage } = await raydium.api.fetchPoolByMints({
                                    mint1: token1.address,
                                    mint2: token2.address,
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
                this.indexerService.setV3PoolBatch(network, currentIndex, poolBatch.pools)
                this.indexerService.setCurrentLineIndex(network, currentIndex, poolBatch.currentLineIndex)
                // cache the pool batch
                await this.cacheManager.set(
                    this.initService.getPoolBatchCacheKey(network, token1.id, token2.id),
                    poolBatch,
                )
            } catch (error) {
                this.logger.error(
                    `Cannot load pool batch for ${token1.id} and ${token2.id}, message: ${error.message}`,
                )
            } finally {
                // we will increase the index to the next pair
                this.indexerService.nextIndex(network)
            }
        })
    }

    private findNextUnloadedLineIndex(network: Network): [number, number] | null {
        const v3PoolBatches = this.indexerService.getV3PoolBatches(network)
        if (!v3PoolBatches.length) {
            this.logger.debug(`Batch is not loaded for ${network}`)
            return null
        }
        for (
            let batchIndex = 0;
            batchIndex < v3PoolBatches.length;
            batchIndex++
        ) {
            const lineIndex = this.indexerService.getCurrentLineIndex(network, batchIndex)
            if (lineIndex < v3PoolBatches[batchIndex].length) {
                if (!v3PoolBatches[batchIndex][lineIndex]) {
                    throw new Error(
                        `Pool is not loaded for ${network} at batch index ${batchIndex} and line index ${lineIndex}`,
                    )
                }
                return [batchIndex, lineIndex]
            }
        }
        // we will increase the index to the next batch
        this.logger.debug(`All lines loaded for ${network}`)
        return null
    }

    // return true if we have loaded all lines for the current index, otherwise not
    public async loadLines(network: Network) {
        this.lockService.withLocks([LOCK_KEYS.LINE], network, async () => {
            const pair = this.findNextUnloadedLineIndex(network)
            if (!pair) {
                // we already loaded all lines for the current index
                return
            }
            const [batchIndex, lineIndex] = pair
            const raydium = this.raydiums[network]
            const pool = this.indexerService.getV3PoolBatch(network, batchIndex)[lineIndex]
            try {
                const poolLines =
                    await this.volumeService.tryActionOrFallbackToVolume<PoolLines>({
                        name: this.initService.getPoolLinesVolumeKey(network, pool.id),
                        action: async () => {
                            const lines = (await raydium.api.getClmmPoolLines(
                                pool.id,
                            )) as unknown as Array<PoolLine>
                            return {
                                poolId: pool.id,
                                lines,
                            }
                        },
                        folderNames: FOLDER_NAMES,
                    })

                await this.cacheManager.set(
                    this.initService.getPoolLinesCacheKey(network, pool.id),
                    poolLines,
                )
            } catch (error) {
                this.logger.error(
                    `Cannot load pool lines for ${pool.id}, message: ${error.message}`,
                )
            } finally {
                this.indexerService.nextLineIndex(network, batchIndex)
            }
        })
    }
}
