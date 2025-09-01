import { Inject, Injectable } from "@nestjs/common"
import { Network } from "@/modules/common"
import { createCacheKey } from "@/modules/cache/utils"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { JitoStakingFetchService } from "./jito-fetch.service"
import { JitoData } from "./jito-level.service"

@Injectable()
export class JitoStakingCacheService {
    constructor(
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly jitoFetchService: JitoStakingFetchService
    ) {}

    private getJitoDataCacheKey(network: Network) {
        return createCacheKey("jito", {
            network,
        })
    }

    public async cacheJitoData(
        network: Network, 
        jitoData: JitoData
    ) {
        await this.cacheManager.set(
            this.getJitoDataCacheKey(network),
            jitoData,
        )
        return jitoData
    }

    public async getJitoData(network: Network) {
        const jitoData = await this.cacheManager.get<JitoData>(
            this.getJitoDataCacheKey(network),
        )
        return jitoData
    }
}