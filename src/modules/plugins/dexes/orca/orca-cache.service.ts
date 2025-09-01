import { Injectable } from "@nestjs/common"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { createCacheKey, InjectMemoryCache } from "@/modules/cache"
import { PoolBatch } from "./orca-data.service"

@Injectable()
export class OrcaDexCacheService {
    constructor(
    @InjectMemoryCache() private readonly cacheManager: Cache,
    ) {}

    private getPoolBatchCacheKey(
        network: Network,
        currentIndex: number,
    ) {
        return createCacheKey("orca-dex-pool-batch", {
            network,
            currentIndex,
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

    public async getPoolBatch(
        network: Network,
        currentIndex: number,
    ) {
        return await this.cacheManager.get<PoolBatch>(
            this.getPoolBatchCacheKey(network, currentIndex),
        )
    }
}
