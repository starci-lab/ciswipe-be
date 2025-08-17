
import { Injectable, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { createCacheKey } from "@/modules/cache"
import { LendingPoolsData, LendingReserveMetadata } from "./solend-level.service"

@Injectable()
export class SolendLendingCacheService {
    constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    private getLendingPoolsDataCacheKey(
        network: Network,
    ) {
        return createCacheKey("lending-pools-batch", {
            network,
        })
    }

    private getLendingReserveMetadataCacheKey(network: Network, reserveAddress: string) {
        return createCacheKey("lending-reserve-metadata", {
            network,
            reserveAddress,
        })
    }

    public async cacheLendingPoolsData(
        network: Network,
        lendingPoolsData: LendingPoolsData,
    ) {
        await this.cacheManager.set(
            this.getLendingPoolsDataCacheKey(network),
            lendingPoolsData,
        )
    }

    public async cacheLendingReserveMetadata(
        network: Network,
        reserveAddress: string,
        lendingReserveMetadata: LendingReserveMetadata,
    ) {
        await this.cacheManager.set(
            this.getLendingReserveMetadataCacheKey(network, reserveAddress),
            lendingReserveMetadata,
        )
    }

    public async getLendingPoolsData(
        network: Network,
    ) {
        return await this.cacheManager.get<LendingPoolsData>(
            this.getLendingPoolsDataCacheKey(network),
        )
    }

    public async getLendingReserveMetadata(network: Network, reserveAddress: string) {
        return await this.cacheManager.get<LendingReserveMetadata>(
            this.getLendingReserveMetadataCacheKey(network, reserveAddress),
        )
    }
}
