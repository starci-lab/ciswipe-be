import { Injectable, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { createCacheKey } from "@/modules/cache"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { PoolBatch, PoolLines } from "./raydium-level.service"

@Injectable()
export class RaydiumCacheService {
    constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly tokenUtilsService: TokenUtilsService,
    ) {}

    private getPoolBatchCacheKey(
        network: Network,
        token1: string,
        token2: string,
    ) {
        [token1, token2] = this.tokenUtilsService.ensureTokensOrderById(
            token1,
            token2,
        )
        return createCacheKey("pool-batch", {
            network,
            token1,
            token2,
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
        token1: string,
        token2: string,
        poolBatch: PoolBatch,
    ) {
        await this.cacheManager.set(
            this.getPoolBatchCacheKey(network, token1, token2),
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

    public async getPoolBatch(network: Network, token1: string, token2: string) {
        return await this.cacheManager.get<PoolBatch>(
            this.getPoolBatchCacheKey(network, token1, token2),
        )
    }

    public async getPoolLines(network: Network, poolId: string) {
        return await this.cacheManager.get<PoolLines>(
            this.getPoolLinesCacheKey(network, poolId),
        )
    }
}
