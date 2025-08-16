import { Injectable, Logger, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network } from "@/modules/common"
import { VolumeService } from "@/modules/volume"
import { createCacheKey } from "@/modules/cache"
import { VaultRawsData, Vault, VaultRaw } from "./kamino-indexer.service"
import { FOLDER_NAMES } from "./constants"

@Injectable()
export class KaminoVaultInitService {
    private logger = new Logger(KaminoVaultInitService.name)

    constructor(
        private readonly volumeService: VolumeService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    public getVaultsCacheKey(network: Network) {
        return createCacheKey("kamino-vaults", {
            network,
        })
    }

    public getVaultCacheKey(network: Network, vaultAddress: string) {
        return createCacheKey("kamino-vault", {
            vaultAddress,
            network,
        })
    }

    public getVaultsVolumeKey(network: Network) {
        return `vaults-${network}.json`
    }

    public getVaultVolumeKey(network: Network, vaultAddress: string) {
        return `vault-${network}-${vaultAddress}.json`
    }

    async cacheAllOnInit() {
        try {
            for (const network of Object.values(Network)) {
                if (network === Network.Testnet) continue
                const vaults = await this.loadAndCacheVaultsFromVolume(network)
                if (!vaults) continue
                const promises: Array<Promise<void>> = []
                for (const vault of vaults.vaults) {
                    promises.push(this.loadAndCacheVaultData(network, vault))
                }
                await Promise.all(promises)
            }
        } catch (error) {
            this.logger.error(`Cannot cache all on init, maybe some IO-reading failed, we try to reload everything, message: ${error.message}`)
        }
    }

    // Load vaults from volume if exists
    private async loadAndCacheVaultsFromVolume(network: Network): Promise<VaultRawsData | null> {
        if (network === Network.Testnet) return null
        try {
            const exists = await this.volumeService.existsInDataVolume({
                name: this.getVaultsVolumeKey(network),
                folderNames: FOLDER_NAMES
            })
            if (!exists) return null

            const vaults = await this.volumeService.readJsonFromDataVolume<VaultRawsData>({
                name: this.getVaultsVolumeKey(network),
                folderNames: FOLDER_NAMES
            })
            await this.cacheManager.set(this.getVaultsCacheKey(network), vaults)
            return vaults
        } catch (err) {
            this.logger.error(`Error loading vaults from volume for ${network}: ${err.message}`)
            return null
        }
    }

    // Load and cache vault data if exists
    private async loadAndCacheVaultData(network: Network, vault: VaultRaw) {
        if (network === Network.Testnet) return
        if (!vault.address) return
        const vaultExists = await this.volumeService.existsInDataVolume({
            name: this.getVaultVolumeKey(network, vault.address.toString()),
            folderNames: FOLDER_NAMES
        })
        if (!vaultExists) return
        const vaultData = await this.volumeService.readJsonFromDataVolume<Vault>({
            name: this.getVaultVolumeKey(network, vault.address.toString()),
            folderNames: FOLDER_NAMES
        })
        await this.cacheManager.set(
            this.getVaultCacheKey(network, vault.address.toString()),
            vaultData,
        )
    }
}
