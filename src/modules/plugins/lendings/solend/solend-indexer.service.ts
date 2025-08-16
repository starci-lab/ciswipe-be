import { Injectable } from "@nestjs/common"
import { Network } from "@/modules/common"
import { Reserve } from "./schema"
import { WithAddressAndStats } from "./solend-rpc.service"

@Injectable()
export class SolendLendingIndexerService {
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }

    private reserves: Record<Network, Array<WithAddressAndStats<Reserve>>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }

    getCurrentIndex(network: Network) {
        return this.currentIndex[network]
    }

    setCurrentIndex(network: Network, index: number) {
        this.currentIndex[network] = index
    }

    nextCurrentIndex(network: Network) {
        this.currentIndex[network]++
    }

    getReserves(network: Network) {
        return this.reserves[network]
    }

    setReserves(network: Network, reserves: Array<WithAddressAndStats<Reserve>>) {
        this.reserves[network] = reserves
    }
}