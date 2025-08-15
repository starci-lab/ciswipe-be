import { Injectable } from "@nestjs/common"
import { Network } from "@/modules/common"
import { VaultRaw } from "./kamino-init.service"

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
