import { Injectable, Logger, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { VolumeService } from "@/modules/volume"
import { FOLDER_NAMES } from "./constants"
import { createCacheKey } from "@/modules/cache"
import { LendingPool, LendingReserveMetadata, PoolsData } from "./solend-fetch.service"

@Injectable()
export class SolendLendingInitService {
    private logger = new Logger(SolendLendingInitService.name)

    constructor(
    private readonly volumeService: VolumeService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    public getLendingPoolsCacheKey(network: Network) {
        return createCacheKey("lending-pools", {
            network,
        })
    }

    public getReserveMetadataCacheKey(network: Network, reserveId: string) {
        return createCacheKey("reserve-metadata", {
            network,
            reserveId,
        })
    }

    public getLendingPoolsVolumeKey(network: Network) {
        return `lending-pools-${network}.json`
    }

    public getReserveMetadataVolumeKey(network: Network, reserveId: string) {
        return `reserve-metadata-${network}-${reserveId}.json`
    }

    async cacheAllOnInit() {
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue
            const lendingPools = await this.loadAndCacheLendingPoolsFromVolume(network)
            if (!lendingPools) continue
            for (const pool of lendingPools.pools) {
                await this.loadAndCacheReserveMetadata(network, pool)
            }
        }
    }

    // Load lending pools from volume if exists
    private async loadAndCacheLendingPoolsFromVolume(network: Network): Promise<PoolsData | null> {
        if (network === Network.Testnet) return null
        try {
            const exists = await this.volumeService.existsInDataVolume({
                name: this.getLendingPoolsVolumeKey(network),
                folderNames: FOLDER_NAMES
            })
            if (!exists) return null

            const lendingPools = await this.volumeService.readJsonFromDataVolume<PoolsData>({
                name: this.getLendingPoolsVolumeKey(network),
                folderNames: FOLDER_NAMES
            })
            // require await
            await this.cacheManager.set(this.getLendingPoolsCacheKey(network), lendingPools)
            return lendingPools
        } catch (err) {
            this.logger.error(`Error loading lending pools from volume for ${network}: ${err.message}`)
            return null
        }
    }

    // Load and cache reserve metadata if exists
    private async loadAndCacheReserveMetadata(network: Network, pool: LendingPool) {
        if (network === Network.Testnet) return
        try {
            for (const reserve of pool.reserves) {
                const reserveExists = await this.volumeService.existsInDataVolume({
                    name: this.getReserveMetadataVolumeKey(network, reserve.reserve.address),
                    folderNames: FOLDER_NAMES
                })
                if (!reserveExists) continue
                const metadata = await this.volumeService.readJsonFromDataVolume<LendingReserveMetadata>({
                    name: this.getReserveMetadataVolumeKey(network, reserve.reserve.address),
                    folderNames: FOLDER_NAMES
                })
                await this.cacheManager.set(
                    this.getReserveMetadataCacheKey(network, reserve.reserve.address),
                    metadata,
                )
            }
        } catch (err) {
            this.logger.error(`Error loading reserve metadata for ${network}: ${err.message}`)
        }
    }
}
