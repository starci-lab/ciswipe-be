import { Injectable } from "@nestjs/common"
import { Network, StrategyAnalysis, StrategyAIInsights } from "@/modules/common"
import { VaultStateJSON } from "@kamino-finance/klend-sdk/dist/lib"
import { VaultMetrics, VaultMetricsHistoryItem } from "./kamino-api.service"
import { Address } from "@solana/kit"

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
export class KaminoVaultIndexerService {
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }

    private vaults: Record<Network, Array<VaultRaw>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }

    getCurrentIndex(network: Network) {
        return this.currentIndex[network] || 0
    }

    setCurrentIndex(network: Network, index: number) {
        this.currentIndex[network] = index
    }

    nextIndex(network: Network) {
        if (typeof this.currentIndex[network] === "undefined") {
            this.currentIndex[network] = 0
        }
        this.currentIndex[network]++
    }

    getVaults(network: Network) {
        return this.vaults[network]
    }

    setVaults(network: Network, vaults: Array<VaultRaw>) {
        this.vaults[network] = vaults
    }
}
