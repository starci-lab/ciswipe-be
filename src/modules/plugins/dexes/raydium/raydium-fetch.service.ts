import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network, sleep } from "@/modules/common"
import {
    createProviderToken,
    RecordRpcProvider,
    tokenPairs,
} from "@/modules/blockchain"
import { Connection } from "@solana/web3.js"
import { Raydium, ApiV3PoolInfoItem } from "@raydium-io/raydium-sdk-v2"
import { Cron, CronExpression } from "@nestjs/schedule"
import { RaydiumInitService } from "./raydium-init.service"
import {
    RaydiumIndexerService,
} from "./raydium-indexer.service"
import { LockService, RetryService } from "@/modules/misc"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { RaydiumApiService } from "./raydium-api.service"
import { RaydiumLevelService } from "./raydium-level.service"

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
        private readonly initService: RaydiumInitService,
        private readonly indexerService: RaydiumIndexerService,
        private readonly lockService: LockService,
        private readonly tokenUtilsService: TokenUtilsService,
        private readonly raydiumApiService: RaydiumApiService,
        private readonly raydiumLevelService: RaydiumLevelService,
        private readonly retryService: RetryService,
    ) { }

    async onModuleInit() {
        await this.retryService.retry({
            action: async () => {
                for (const network of Object.values(Network)) {
                    await this.initService.loadGlobalData(network)
                }
                // 2. Load all on init
                await this.initService.loadAllOnInit()
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
        })
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async handleLoadPoolBatch() {
        await this.retryService.retry({
            action: async () => {
                for (const network of Object.values(Network)) {
                    await this.loadPoolBatch(network)
                }
            }
        })
    }

    @Cron("*/3 * * * * *")
    async handleloadPoolLines() {
        await this.retryService.retry({
            action: async () => {
                for (const network of Object.values(Network)) {
                    await this.loadPoolLines(network)
                }
            }
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
                // if the first pair is not loaded, we will return
                // if we load end the pairs, we will return to the start index
                this.indexerService.tryResetCurrentIndex(network)
                // now we try to get the current index that was reseted
                const currentIndex = this.indexerService.getCurrentIndex(network)
                const [token1, token2] =
                    this.tokenUtilsService.tryGetWrappedTokens({
                        tokens: this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)[currentIndex],
                        network,
                        chainKey: ChainKey.Solana,
                    })
                try {
                    // raydium only support Solana, so that we dont care about ChainKey
                    const raydium = this.raydiums[network]
                    const poolBatch = await this.raydiumLevelService.getPoolBatch(
                        network,
                        this.indexerService.getCurrentIndex(network),
                        async () => {
                            const pools: Array<ApiV3PoolInfoItem> = []
                            try {
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
                                    pools: pools.map(pool => ({
                                        pool,
                                    })),
                                    currentLineIndex: 0,
                                }
                            } catch (error) {
                                this.logger.error(
                                    `Cannot load pool batch for ${token1.id} and ${token2.id}, message: ${error.message}`,
                                )
                                return null
                            }
                        },
                    )
                    if (!poolBatch) {
                        this.logger.error(
                            `Cannot load pool batch for ${token1.id} and ${token2.id}, message: Pool batch is not found`,
                        )
                        return
                    }
                    this.indexerService.setV3PoolBatchAndCurrentLineIndex(network, currentIndex, poolBatch)
                    this.indexerService.setV3PoolBatch(
                        network,
                        currentIndex,
                        poolBatch?.pools.map(pool => pool.pool) || [],
                    )
                    this.indexerService.setCurrentLineIndex(
                        network,
                        currentIndex,
                    )
                    // update the indexer
                    this.indexerService.setV3PoolBatchAndCurrentLineIndex(network, currentIndex, poolBatch)
                    // log the pool batch
                    this.logger.debug(
                        `Loaded pool batch for 
                      ${token1.id} 
                      and 
                      ${token2.id}, 
                      index: ${currentIndex}, 
                      total pools: ${poolBatch.pools.length},
                      total pairs: ${tokenPairs[ChainKey.Solana][network].length},
                      current line index: ${this.indexerService.getCurrentLineIndex(network, currentIndex)},
                      total v3 pool batches: ${this.indexerService.getV3PoolBatches(network)[currentIndex]?.length}
                      `,
                    )
                } catch (error) {
                    this.logger.error(
                        `Cannot load pool batch for ${token1.id} and ${token2.id}, message: ${error.message}`,
                    )
                } finally {
                    try {
                        // we will increase the index to the next pair
                        this.indexerService.nextCurrentIndex(network)
                        // update the global data
                        await this.initService.loadGlobalData(network)
                    } catch (error) {
                        this.logger.error(
                            `Cannot increase index for ${network}, message: ${error.message}`,
                        )
                    }
                }
            },
        })
    }

    // return true if we have loaded all lines for the current index, otherwise not
    public async loadPoolLines(
        network: Network
    ) {
        await this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.POOL_LINES, LOCK_KEYS.POOL_BATCH],
            acquiredKeys: [LOCK_KEYS.POOL_LINES],
            // no authorized to release batch
            releaseKeys: [LOCK_KEYS.POOL_LINES],
            network,
            callback: async () => {
                if (network === Network.Testnet) {
                    return
                }
                const pair = this.indexerService.findNextUnloadedLineIndex(network)
                if (!pair) {
                    // we already loaded all lines for the current index, or some errors happened
                    return
                }
                const [batchIndex, lineIndex] = pair
                const pool = this.indexerService.getV3PoolBatch(network, batchIndex)[
                    lineIndex
                ]
                try {
                    const poolLines =
                        await this.raydiumLevelService.getPoolLines(
                            network,
                            pool.poolId,
                            async () => {
                                const liquidityLines =
                                    await this.raydiumApiService.fetchPoolLines(pool.poolId)
                                // sleep 1000s to avoid rate limit
                                await sleep(1000)
                                const positionLines =
                                    await this.raydiumApiService.fetchPoolPositions(pool.poolId)
                                return {
                                    poolId: pool.poolId,
                                    liquidityLines,
                                    positionLines,
                                }
                            },
                        )
                    if (!poolLines) {
                        this.logger.error(
                            `Cannot load pool lines for ${pool.poolId}, message: Pool lines is not found`,
                        )
                        return
                    }
                    // update the indexer
                    // log the pool lines
                    this.logger.warn(
                        `Loaded pool lines for 
                      ${pool.poolId}, 
                      pair: ${this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)[batchIndex][0].id} and ${this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)[batchIndex][1].id}, 
                      batch index: ${batchIndex},
                      line index: ${lineIndex}, 
                      total lines: ${this.indexerService.getV3PoolBatch(network, batchIndex).length},
                      total pairs: ${tokenPairs[ChainKey.Solana][network].length}
                      `,
                    )
                } catch (error) {
                    this.logger.error(
                        `Cannot load pool lines for ${pool.poolId}, message: ${error.message}`,
                    )
                } finally {
                    try {
                        this.indexerService.nextCurrentLineIndex(network, batchIndex)
                        // update the the current line index
                        await this.raydiumLevelService.increaseLineIndex(network, batchIndex)
                    } catch (error) {
                        // if cannot log, it will keep this re-run again in 3s, 100% IO problems, not my code
                        this.logger.error(
                            `Cannot increase line index for ${pool.poolId}, message: ${error.message}`,
                        )
                    }
                }
            },
        })
    }

}
