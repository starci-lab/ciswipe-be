import { Inject, Injectable, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network, PluginProtocolName, sleep } from "@/modules/common"
import {
    createProviderToken,
    RecordRpcProvider,
    tokenPairs,
} from "@/modules/blockchain"
import { Connection } from "@solana/web3.js"
import { Raydium, ApiV3PoolInfoItem } from "@raydium-io/raydium-sdk-v2"
import { Cron, CronExpression } from "@nestjs/schedule"
import { RaydiumDexIndexerService } from "./raydium-indexer.service"
import { LockService, RetryService } from "@/modules/misc"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { RaydiumDexApiService } from "./raydium-api.service"
import { PoolBatch, RaydiumDexDataService } from "./raydium-data.service"
import { RaydiumDexCacheService } from "./raydium-cache.service"
import { InjectWinstonLogging } from "@/modules/loki"
import { Logger } from "winston"

const LOCK_KEYS = {
    POOL_BATCH: "RAYDIUM_DEX_POOL_BATCH",
    POOL_LINES: "RAYDIUM_DEX_POOL_LINE",
}

@Injectable()
export class RaydiumDexFetchService implements OnModuleInit {
    private raydiums: Record<Network, Raydium>
    private readonly context = RaydiumDexFetchService.name
    private readonly protocolName = PluginProtocolName.DexRaydium
    private readonly chain = ChainKey.Solana

    constructor(
        @Inject(createProviderToken(ChainKey.Solana))
        private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
        private readonly raydiumDexIndexerService: RaydiumDexIndexerService,
        private readonly lockService: LockService,
        private readonly tokenUtilsService: TokenUtilsService,
        private readonly raydiumDexApiService: RaydiumDexApiService,
        private readonly raydiumDexDataService: RaydiumDexDataService,
        private readonly retryService: RetryService,
        private readonly raydiumDexCacheService: RaydiumDexCacheService,
        @InjectWinstonLogging()
        private readonly logger: Logger,
    ) { }

    async onModuleInit() {
        await this.retryService.retry({
            action: async () => {
                const _raydiums: Partial<Record<Network, Raydium>> = {}
                for (const network of Object.values(Network)) {
                    _raydiums[network] = await Raydium.load({
                        connection: this.solanaRpcProvider[network],
                    })
                }
                this.raydiums = _raydiums as Record<Network, Raydium>
                this.logger.info(
                    "ModuleInitialized",
                    {
                        protocolName: this.protocolName,
                        chain: this.chain,
                        loadedNetworks: Object.keys(this.raydiums),
                    }
                )
            },
        })
    }

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

    @Cron("*/3 * * * * *")
    async handleloadPoolLines() {
        await this.retryService.retry({
            action: async () => {
                for (const network of Object.values(Network)) {
                    await this.loadPoolLines(network)
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

                this.raydiumDexIndexerService.tryResetCurrentIndex(network)
                const currentIndex = this.raydiumDexIndexerService.getCurrentIndex(network)

                if (
                    this.tokenUtilsService.checkEveryPairsLoaded(this.chain, network, currentIndex)
                ) {
                    this.logger.verbose(
                        "EveryPairsLoaded",
                        {
                            chain: this.chain,
                            network,
                            currentIndex,
                        })
                    return
                }

                const pairs = this.tokenUtilsService.getPairsWithoutNativeToken(this.chain, network)
                this.logger.debug(  
                    "PairsWithoutNativeCount",
                    {
                        context: this.context,
                        protocolName: this.protocolName,
                        chain: this.chain,
                        network,
                        pairsCount: pairs.length,
                    }
                )

                const [token0, token1] = pairs[currentIndex]
                try {
                    const raydium = this.raydiums[network]
                    const poolBatch = await this.raydiumDexDataService.getPoolBatch(
                        network,
                        currentIndex,
                        async () => {
                            const pools: Array<ApiV3PoolInfoItem> = []
                            try {
                                let nextPage = 0
                                let nextPageAvailable = true
                                while (nextPageAvailable) {
                                    if (!token0.tokenAddress || !token1.tokenAddress) {
                                        throw new Error(
                                            `Token address is not found for ${token0.id} and ${token1.id}`,
                                        )
                                    }
                                    const { data, hasNextPage } = await raydium.api.fetchPoolByMints({
                                        mint1: token0.tokenAddress,
                                        mint2: token1.tokenAddress,
                                        page: nextPage,
                                    })
                                    pools.push(...data)
                                    nextPage++
                                    nextPageAvailable = hasNextPage
                                    if (hasNextPage) {
                                        this.logger.debug(
                                            "MorePoolsFoundSleepingToAvoidRateLimit",
                                            {
                                                context: this.context,
                                                protocolName: this.protocolName,
                                                chain: this.chain,
                                                network,
                                                token0: token0.id,
                                                token1: token1.id,
                                                nextPage,
                                                sleepMs: 1000,
                                            })
                                        await sleep(1000)
                                    }
                                }

                                const poolBatch: PoolBatch = {
                                    pools: pools.map((pool) => ({ pool })),
                                    currentLineIndex: 0,
                                }
                                await this.raydiumDexCacheService.cachePoolBatch(network, currentIndex, poolBatch)

                                this.logger.info(
                                    "PoolBatchCached",
                                    {
                                        context: this.context,
                                        protocolName: this.protocolName,
                                        chain: this.chain,
                                        network,
                                        token0: token0.id,
                                        token1: token1.id,
                                        currentIndex,
                                        poolsCount: pools.length,
                                    }
                                )
                                return poolBatch
                            } catch (error) {
                                this.logger.error(
                                    "PoolBatchLoadFailed",
                                    {
                                        context: this.context,
                                        protocolName: this.protocolName,
                                        chain: this.chain,
                                        network,
                                        token0: token0.id,
                                        token1: token1.id,
                                        currentIndex,
                                        error: error?.message,
                                        stack: error?.stack,
                                    })
                                return null
                            }
                        },
                    )

                    if (!poolBatch) {
                        this.logger.error(
                            "PoolBatchNotFound",
                            {
                                context: this.context,
                                protocolName: this.protocolName,
                                chain: this.chain,
                                network,
                                token0: token0.id,
                                token1: token1.id,
                                currentIndex,
                            })
                        return
                    }

                    this.raydiumDexIndexerService.setV3PoolBatchAndCurrentLineIndex(
                        network,
                        currentIndex,
                        poolBatch,
                    )

                    await this.raydiumDexCacheService.cachePoolBatch(network, currentIndex, poolBatch)

                    this.logger.info(
                        "PoolBatchLoaded",
                        {
                            context: this.context,
                            protocolName: this.protocolName,
                            chain: this.chain,
                            network,
                            token0: token0.id,
                            token1: token1.id,
                            currentIndex,
                            poolsCount: poolBatch.pools.length,
                            totalPairs: tokenPairs[this.chain][network].length,
                            currentLineIndex: this.raydiumDexIndexerService.getCurrentLineIndex(
                                network,
                                currentIndex,
                            ),
                            totalV3PoolBatches:
                            this.raydiumDexIndexerService.getV3PoolBatches(network)[currentIndex]?.length,
                        })
                } catch (error) {
                    this.logger.error(
                        "PoolBatchTopLevelError",
                        {
                            context: this.context,
                            protocolName: this.protocolName,
                            chain: this.chain,
                            network,
                            token0: token0?.id,
                            token1: token1?.id,
                            currentIndex,
                            error: error?.message,
                            stack: error?.stack,
                        })
                } finally {
                    await this.retryService.retry({
                        action: async () => {
                            this.raydiumDexIndexerService.nextCurrentIndex(network)
                            await this.raydiumDexDataService.increaseCurrentIndex(network)

                            this.logger.verbose(
                                "AdvanceToNextPairIndex",
                                {
                                    context: this.context,
                                    protocolName: this.protocolName,
                                    chain: this.chain,
                                    network,
                                    nextIndex: this.raydiumDexIndexerService.getCurrentIndex(network),
                                })
                        },
                    })
                }
            },
        })
    }

    // return true if we have loaded all lines for the current index, otherwise not
    public async loadPoolLines(network: Network) {
        await this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.POOL_LINES, LOCK_KEYS.POOL_BATCH],
            acquiredKeys: [LOCK_KEYS.POOL_LINES],
            releaseKeys: [LOCK_KEYS.POOL_LINES],
            network,
            callback: async () => {
                if (network === Network.Testnet) {
                    return
                }

                const pairIdx = this.raydiumDexIndexerService.findNextUnloadedLineIndex(network)
                if (!pairIdx) {
                    this.logger.verbose(
                        "NoUnloadedLineIndex",
                        {
                            context: this.context,
                            protocolName: this.protocolName,
                            chain: this.chain,
                            network,
                        })
                    return
                }

                const [batchIndex, lineIndex] = pairIdx
                const pool = this.raydiumDexIndexerService.getV3PoolBatch(network, batchIndex)[lineIndex]

                try {
                    const poolLines = await this.raydiumDexDataService.getPoolLines(
                        network,
                        pool.poolId,
                        async () => {
                            const liquidityLines = await this.raydiumDexApiService.fetchPoolLines(pool.poolId)
                            await sleep(1000) // avoid rate limit
                            const positionLines = await this.raydiumDexApiService.fetchPoolPositions(pool.poolId)
                            return {
                                poolId: pool.poolId,
                                liquidityLines,
                                positionLines,
                            }
                        },
                    )

                    if (!poolLines) {
                        this.logger.error(
                            "PoolLinesNotFound",
                            {
                                context: this.context,
                                protocolName: this.protocolName,
                                chain: this.chain,
                                network,
                                poolId: pool.poolId,
                                batchIndex,
                                lineIndex,
                            })
                        return
                    }

                    await this.raydiumDexCacheService.cachePoolLines(network, pool.poolId, poolLines)

                    const [p0, p1] = this.tokenUtilsService.getPairsWithoutNativeToken(
                        this.chain,
                        network,
                    )[batchIndex]

                    this.logger.info(
                        "PoolLinesLoaded",
                        {
                            context: this.context,
                            protocolName: this.protocolName,
                            chain: this.chain,
                            network,
                            poolId: pool.poolId,
                            pairToken0: p0.id,
                            pairToken1: p1.id,
                            batchIndex,
                            lineIndex,
                            totalLines: this.raydiumDexIndexerService.getV3PoolBatch(network, batchIndex).length,
                            totalPairs: tokenPairs[this.chain][network].length,
                        })
                } catch (error) {
                    this.logger.error(
                        "PoolLinesLoadFailed",
                        {
                            context: this.context,
                            protocolName: this.protocolName,
                            chain: this.chain,
                            network,
                            poolId: pool.poolId,
                            batchIndex,
                            lineIndex,
                            error: error?.message,
                            stack: error?.stack,
                        }
                    )
                } finally {
                    await this.retryService.retry({
                        action: async () => {
                            this.raydiumDexIndexerService.nextCurrentLineIndex(network, batchIndex)
                            await this.raydiumDexDataService.increaseLineIndex(network, batchIndex)

                            this.logger.verbose(
                                "AdvanceToNextLineIndex",
                                {
                                    context: this.context,
                                    protocolName: this.protocolName,
                                    chain: this.chain,
                                    network,
                                    batchIndex,
                                    nextLineIndex: this.raydiumDexIndexerService.getCurrentLineIndex(
                                        network,
                                        batchIndex,
                                    ),
                                })
                        },
                    })
                }
            },
        })
    }
}
