import { Injectable } from "@nestjs/common"
import { Network } from "@/modules/common"

export interface ReserveData {
    reserveId: string
}

@Injectable()
export class SolendLendingIndexerService {
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }

    private reserves: Record<Network, Array<ReserveData>> = {
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

    setReserves(network: Network, reserves: Array<ReserveData>) {
        this.reserves[network] = reserves
    }

    setReserveAndCurrentIndex(
        network: Network,
        reserves: Array<ReserveData>,
        currentIndex: number,
    ) {
        this.setReserves(network, reserves)
        this.setCurrentIndex(network, currentIndex)
    }
}