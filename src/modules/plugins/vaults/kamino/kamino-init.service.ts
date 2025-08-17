import { Injectable, Logger } from "@nestjs/common"
import { Network } from "@/modules/common"
import { KaminoVaultIndexerService } from "./kamino-indexer.service"
import { VaultsData } from "./kamino-level.service"
import { KaminoVaultCacheService } from "./kamino-cache.service"
import { KaminoVaultLevelService } from "./kamino-level.service"
import { RetryService } from "@/modules/misc"

@Injectable()
export class KaminoVaultInitService {
    private logger = new Logger(KaminoVaultInitService.name)

    constructor(
    private readonly kaminoVaultCacheService: KaminoVaultCacheService,
    private readonly kaminoVaultLevelService: KaminoVaultLevelService,
    private readonly kaminoVaultIndexerService: KaminoVaultIndexerService,
    private readonly retryService: RetryService,
    ) {}

    async loadAndCacheAllOnInit() {
        await this.retryService.retry(
            {
                action: async () => {
                    for (const network of Object.values(Network)) {
                        if (network === Network.Testnet) continue
                        const vaults = await this.loadAndCacheVaultsData(network)
                        if (!vaults) continue
                        const promises: Array<Promise<void>> = []
                        for (const vault of vaults.vaults) {
                            promises.push(
                                this.loadAndCacheVaultMetadata(network, vault.address?.toString() || ""),
                            )
                        }
                        await Promise.all(promises)
                    }
                }
            },
        )
    }

    // Load vaults from volume if exists
    private async loadAndCacheVaultsData(
        network: Network,
    ): Promise<VaultsData | null> {
        if (network === Network.Testnet) return null
        const vaultRawsData =
      await this.kaminoVaultLevelService.getVaultsData(network)
        if (!vaultRawsData) return null
        await this.kaminoVaultCacheService.cacheVaultsData(network, vaultRawsData)
        // update the indexer
        this.kaminoVaultIndexerService.setVaultsAndCurrentIndex(
            network,
            vaultRawsData.vaults.map((vault) => ({
                vaultId: vault.address?.toString() || "",
            })),
            vaultRawsData.currentIndex,
        )
        return vaultRawsData
    }

    // Load and cache vault data if exists
    private async loadAndCacheVaultMetadata(network: Network, vaultId: string) {
        if (network === Network.Testnet) return
        const vaultMetadata = await this.kaminoVaultLevelService.getVaultMetadata(network, vaultId)
        if (!vaultMetadata) return
        await this.kaminoVaultCacheService.cacheVault(network, vaultId, vaultMetadata)
    }
}
