import { Injectable, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { createCacheKey } from "@/modules/cache"
import { VaultMetadata, VaultsData } from "./kamino-level.service"

@Injectable()
export class KaminoVaultCacheService {
    constructor(
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    private getVaultsDataCacheKey(network: Network) {
        return createCacheKey("vaults-data", {
            network,
        })
    }

    private getVaultMetadataCacheKey(network: Network, vaultAddress: string) {
        return createCacheKey("vault-metadata", {
            network,
            vaultAddress,
        })
    }

    public async cacheVaultsData(
        network: Network,
        vaultsData: VaultsData,
    ) {
        await this.cacheManager.set(
            this.getVaultsDataCacheKey(network),
            vaultsData,
        )
    }

    public async cacheVault(
        network: Network,
        vaultAddress: string,
        vaultMetadata: VaultMetadata,
    ) {
        // we have to remove the metric history from cache
        // to ensure that we do not cache the metric history
        vaultMetadata.metricsHistory = undefined
        await this.cacheManager.set(
            this.getVaultMetadataCacheKey(network, vaultAddress),
            vaultMetadata,
        )
    }

    public async getVaultsData(network: Network) {
        return await this.cacheManager.get<VaultsData>(
            this.getVaultsDataCacheKey(network),
        )
    }

    public async getVaultMetadata(network: Network, vaultAddress: string) {
        return await this.cacheManager.get<VaultMetadata>(
            this.getVaultMetadataCacheKey(network, vaultAddress),
        )
    }
}
