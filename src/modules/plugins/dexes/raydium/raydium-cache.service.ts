import { Injectable } from "@nestjs/common"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { createCacheKey, InjectMemoryCache } from "@/modules/cache"
import { PoolBatch, PoolLines } from "./raydium-data.service"

@Injectable()
export class RaydiumDexCacheService {
    constructor(
    @InjectMemoryCache() private readonly cacheManager: Cache,
    ) {}

    private getPoolBatchCacheKey(
        network: Network,
        currentIndex: number,
    ) {
        return createCacheKey("pool-batch", {
            network,
            currentIndex,
        })
    }

    private getPoolLinesCacheKey(network: Network, poolId: string) {
        return createCacheKey("pool-lines", {
            network,
            poolId,
        })
    }

    public async cachePoolBatch(
        network: Network,
        currentIndex: number,
        poolBatch: PoolBatch,
    ) {
        await this.cacheManager.set(
            this.getPoolBatchCacheKey(network, currentIndex),
            poolBatch,
        )
    }

    public async cachePoolLines(
        network: Network,
        poolId: string,
        poolLines: PoolLines,
    ) {
        await this.cacheManager.set(
            this.getPoolLinesCacheKey(network, poolId),
            poolLines,
        )
    }

    public async getPoolBatch(
        network: Network,
        currentIndex: number,
    ) {
        return await this.cacheManager.get<PoolBatch>(
            this.getPoolBatchCacheKey(network, currentIndex),
        )
    }

    public async getPoolLines(network: Network, poolId: string) {
        return await this.cacheManager.get<PoolLines>(
            this.getPoolLinesCacheKey(network, poolId),
        )
    }
}
