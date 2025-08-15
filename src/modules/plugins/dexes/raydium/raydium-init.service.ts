import { Injectable, Logger, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network, ChainKey } from "@/modules/common"
import { VolumeService } from "@/modules/volume"
import { createCacheKey } from "@/modules/cache"
import { ApiV3PoolInfoBaseItem } from "@raydium-io/raydium-sdk-v2"
import { tokenPairs } from "@/modules/blockchain"
import { FOLDER_NAMES } from "./constants"

export interface PoolBatch {
    pools: Array<ApiV3PoolInfoBaseItem>;
    currentLineIndex: number;
}

export interface PoolLine {
    liquidity: number;
    price: number;
    tick: number;
}

export interface PoolLines {
    poolId: string;
    lines: Array<PoolLine>;
}

export interface GlobalData {
    currentIndex: number
}

@Injectable()
export class RaydiumInitService {
    private logger = new Logger(RaydiumInitService.name)

    constructor(
        private readonly volumeService: VolumeService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
    ) {}

    public getPoolBatchCacheKey(network: Network, token1: string, token2: string) {
        [token1, token2] = this.ensureTokensOrder(token1, token2)
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

    private ensureTokensOrder(token1: string, token2: string) {
        if (Buffer.byteLength(token1) > Buffer.byteLength(token2)) {
            [token1, token2] = [token2, token1]
        }
        return [token1, token2]
    }

    public getPoolBatchVolumeKey(network: Network, token1: string, token2: string) {
        [token1, token2] = this.ensureTokensOrder(token1, token2)
        return `pool-batch-${network}-${token1}-${token2}.json`
    }

    public getPoolLinesVolumeKey(network: Network, poolId: string) {
        return `pool-lines-${network}-${poolId}.json`
    }

    public getGlobalDataVolumeKey(network: Network) {
        return `global-data-${network}.json`
    }

    async cacheAllOnInit(currentIndexes: Record<Network, number>) {
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue
    
            const pairs = tokenPairs[network][ChainKey.Solana] || []
            for (let index = 0; index < currentIndexes[network]; index++) {
                const [token1, token2] = pairs[index] || []
                if (!token1 || !token2) continue
                try {
                    // 1. Load pool batch
                    const poolBatchVolumeName = this.getPoolBatchVolumeKey(network, token1.id, token2.id)
                    if (!await this.volumeService.existsInDataVolume({
                        name: poolBatchVolumeName,
                        folderNames: FOLDER_NAMES,
                    })) {
                        continue
                    }
                    const poolBatch = await this.volumeService.readJsonFromDataVolume<PoolBatch>({
                        name: poolBatchVolumeName,
                        folderNames: FOLDER_NAMES,
                    })
                    await this.cacheManager.set(
                        this.getPoolBatchCacheKey(network, token1.id, token2.id),
                        poolBatch
                    )
                    // 2. Load line batch
                    for (const pool of poolBatch.pools || []) {
                        if (!pool.id) continue
                        try {
                            const lineBatchVolumeName = this.getPoolLinesVolumeKey(network, pool.id)
                            if (!await this.volumeService.existsInDataVolume({
                                name: lineBatchVolumeName,
                                folderNames: FOLDER_NAMES,
                            })) {
                                continue
                            }
                            const lines = await this.volumeService.readJsonFromDataVolume<PoolLines>({
                                name: lineBatchVolumeName,
                                folderNames: FOLDER_NAMES,
                            })
                            await this.cacheManager.set(
                                this.getPoolLinesCacheKey(network, pool.id),
                                lines
                            )
                        } catch (poolLinesErr) {
                            this.logger.error(
                                `Failed to cache lines for pool ${pool.id} on ${network}:`,
                                poolLinesErr.error
                            )
                        }
                    }
                } catch (poolBatchErr) {
                    this.logger.error(
                        `Failed to cache pool batch for ${token1?.symbol}-${token2?.symbol} on ${network}:`,
                        poolBatchErr.error
                    )
                }
            }
        }
    }

    async loadGlobalData(network: Network): Promise<GlobalData> {
        try {
            const globalData = await this.volumeService.tryActionOrFallbackToVolume<GlobalData>({
                name: this.getGlobalDataVolumeKey(network),
                action: async () => {
                    return {
                        currentIndex: 0,
                    }
                },
                folderNames: FOLDER_NAMES,
            })
            return globalData
        } catch (error) {
            this.logger.error(`Cannot load global data for ${network}, message: ${error.message}`)
            return { currentIndex: 0 }
        }
    }
}
