import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { Network } from "@/modules/common"
import { SolendLendingIndexerService } from "./solend-indexer.service"
import { SolendLendingLevelService } from "./solend-level.service"
import { SolendLendingCacheService } from "./solend-cache.service"
import { RetryService } from "@/modules/misc"

@Injectable()
export class SolendLendingInitService implements OnModuleInit {
    private logger = new Logger(SolendLendingInitService.name)

    constructor(
        private readonly retryService: RetryService,
        private readonly solendLendingLevelService: SolendLendingLevelService,
        private readonly solendLendingIndexerService: SolendLendingIndexerService,
        private readonly solendLendingCacheService: SolendLendingCacheService,
    ) {}

    async onModuleInit() {
        await this.loadAndCacheAllOnInit()
    }

    private async loadAndCacheLendingPoolsData(network: Network) {
        const lendingPoolsData = await this.solendLendingLevelService.getLendingPoolsData(network)
        if (!lendingPoolsData) return null
        await this.solendLendingCacheService.cacheLendingPoolsData(network, lendingPoolsData)
        this.solendLendingIndexerService.setReserveAndCurrentIndex(
            network,
            lendingPoolsData.pools.flatMap((pool) => pool.reserves.map((reserve) => ({
                reserveId: reserve.reserve.address,
            }))),
            lendingPoolsData.currentIndex,
        )
        return lendingPoolsData
    }

    private async loadAndCacheReserveMetadata(network: Network, reserveAddress: string) {
        if (!reserveAddress) return
        const reserveMetadata = await this.solendLendingLevelService.getLendingReserveMetadata(network, reserveAddress)
        if (!reserveMetadata) return
        await this.solendLendingCacheService.cacheLendingReserveMetadata(network, reserveAddress, reserveMetadata)
    }

    async loadAndCacheAllOnInit() {
        await this.retryService.retry(
            {
                action: async () => {
                    for (const network of Object.values(Network)) {
                        if (network === Network.Testnet) continue
                        const lendingPoolsData = await this.loadAndCacheLendingPoolsData(network)
                        if (!lendingPoolsData?.pools) return
                        const promises: Array<Promise<void>> = []
                        const allReserves = lendingPoolsData.pools
                            .map((pool) => pool.reserves)
                            .flat()
                        for (const reserve of allReserves) {
                            promises.push(
                                this.loadAndCacheReserveMetadata(network, reserve.reserve.address)
                            )
                        }
                        await Promise.all(promises)
                        this.logger.fatal(`Initialized lending pool batch for ${network}: ${lendingPoolsData.pools.length} pools`)
                    }
                }
            },
        )
    }
}
