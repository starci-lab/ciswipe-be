import { Injectable, Logger, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network, StrategyAIInsights, StrategyAnalysis } from "@/modules/common"
import { VolumeService } from "@/modules/volume"
import { createCacheKey } from "@/modules/cache"
import { VaultMetrics, VaultMetricsHistoryItem } from "./kamino-api.service"
import { VaultStateJSON } from "@kamino-finance/klend-sdk"
import { Address } from "@solana/kit"
import { FOLDER_NAMES } from "./constants"

export interface VaultRaw {
    state: VaultStateJSON | undefined;
    address: Address | undefined;
  }
  
export interface VaultRawsData {
    vaults: Array<VaultRaw>;
    currentIndex: number;
}
  
export interface Vault {
    // address of the vault
    address: string;
    // metrics of the vault, about the apr, etc
    metrics: VaultMetrics;
    // state of the vault, about the vault address, etc
    state: VaultStateJSON | undefined;
    // metrics history of the vault, about the apr, etc
    metricsHistory: Array<VaultMetricsHistoryItem>;
    // strategy analysis
    strategyAnalysis: StrategyAnalysis;
    // ai insights
    aiInsights?: StrategyAIInsights;
}     

@Injectable()
export class KaminoVaultInitService {
    private logger = new Logger(KaminoVaultInitService.name)

    constructor(
        private readonly volumeService: VolumeService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
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
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue
            const vaults = await this.loadAndCacheVaultsFromVolume(network)
            if (!vaults) continue
            await this.loadAndCacheVaultData(network, vaults)
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
    private async loadAndCacheVaultData(network: Network, vaults: VaultRawsData) {
        if (network === Network.Testnet) return
        try {
            for (const vault of vaults.vaults) {
                if (!vault.address) continue
                const vaultExists = await this.volumeService.existsInDataVolume({
                    name: this.getVaultVolumeKey(network, vault.address.toString()),
                    folderNames: FOLDER_NAMES
                })
                if (!vaultExists) continue
                const vaultData = await this.volumeService.readJsonFromDataVolume<Vault>({
                    name: this.getVaultVolumeKey(network, vault.address.toString()),
                    folderNames: FOLDER_NAMES
                })
                await this.cacheManager.set(
                    this.getVaultCacheKey(network, vault.address.toString()),
                    vaultData,
                )
            }
        } catch (err) {
            this.logger.error(`Error loading vault data for ${network}: ${err.message}`)
        }
    }
}
