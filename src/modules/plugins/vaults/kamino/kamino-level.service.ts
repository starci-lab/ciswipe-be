// lowest layer to interact with level db
import { Injectable } from "@nestjs/common"
import {
    Network,
    StrategyAIInsights,
    StrategyAnalysis,
} from "@/modules/common"
import { LevelHelpersService } from "@/modules/databases"
import { VaultMetrics, VaultMetricsHistoryItem } from "./kamino-api.service"
import { VaultStateJSON } from "@kamino-finance/klend-sdk"
import { Address } from "@solana/kit"

export interface Vault {
  state: VaultStateJSON | undefined;
  address: Address | undefined;
}

export interface VaultsData {
  vaults: Array<Vault>;
  currentIndex: number;
}

export interface VaultMetadata {
  // address of the vault
  address: string;
  // metrics of the vault, about the apr, etc
  metrics: VaultMetrics;
  // state of the vault, about the vault address, etc
  state: VaultStateJSON | undefined;
  // metrics history of the vault, about the apr, etc
  // this only stored in level, we do not cache it
  metricsHistory?: Array<VaultMetricsHistoryItem>;
  // strategy analysis
  strategyAnalysis: StrategyAnalysis;
  // ai insights
  aiInsights?: StrategyAIInsights;
}

const VAULTS_DATA_KEY = "vaults-data"
const VAULT_METADATA_KEY = "vault-metadata"

@Injectable()
export class KaminoVaultLevelService {
    constructor(
    private readonly levelHelpersService: LevelHelpersService,
    ) {}

    public async getVaultsData(
        network: Network,
        action?: () => Promise<VaultsData | null>,
    ) {
        const key = this.levelHelpersService.createKey(VAULTS_DATA_KEY, network)
        if (action) {
            return this.levelHelpersService.getOrFetchFromLevel({
                levelKey: key,
                network,
                action,
            })
        }
        return this.levelHelpersService.fetchFromLevel<VaultsData>({
            levelKey: key,
            network,
        })
    }

    public async getVaultMetadata(
        network: Network,
        vaultAddress: string,
        action?: () => Promise<VaultMetadata | null>,
    ) {
        const key = this.levelHelpersService.createKey(
            VAULT_METADATA_KEY,
            network,
            vaultAddress,
        )
        if (action) {
            return this.levelHelpersService.getOrFetchFromLevel({
                levelKey: key,
                network,
                action,
            })
        }
        return this.levelHelpersService.fetchFromLevel<VaultMetadata>({
            levelKey: key,
            network,
        })
    }
}
