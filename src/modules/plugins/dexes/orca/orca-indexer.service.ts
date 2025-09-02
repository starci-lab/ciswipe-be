import { Injectable } from "@nestjs/common"
import { ChainKey, Network, PluginProtocolName } from "@/modules/common"
import { tokenPairs } from "@/modules/blockchain"
import { OrcaWhirlpool } from "./orca-api.service"
import { InjectWinstonLogging } from "@/modules/loki"
import { Logger } from "winston"

export interface V3PoolIndexData {
  poolId: string;
}

@Injectable()
export class OrcaDexIndexerService {
    private readonly context = OrcaDexIndexerService.name
    private readonly protocolName = PluginProtocolName.DexOrca
    private readonly chain = ChainKey.Solana
    constructor(
    @InjectWinstonLogging()
    private readonly logger: Logger,
    ) {}

    // current index for load lines index
    // if null, the index is not initialized
    private currentLineIndex: Record<
    Network,
    Record<number, number | undefined>
  > = {
            [Network.Mainnet]: {},
            [Network.Testnet]: {},
        }

    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }

    private v3PoolBatches: Record<Network, Array<Array<V3PoolIndexData>>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }

    getCurrentIndex(network: Network) {
        return this.currentIndex[network] || 0
    }

    setCurrentIndex(network: Network, batchIndex: number) {
        this.currentIndex[network] = batchIndex
    }

    getV3PoolBatches(network: Network) {
        return this.v3PoolBatches[network] || []
    }

    setV3PoolBatch(
        network: Network,
        batchIndex: number,
        pools: Array<OrcaWhirlpool>,
    ) {
        if (!this.v3PoolBatches[network]) {
            this.v3PoolBatches[network] = []
        }
        this.v3PoolBatches[network][batchIndex] = pools.map((pool) => ({
            poolId: pool.address,
        }))
    }

    getV3PoolBatch(network: Network, batchIndex: number) {
        return this.v3PoolBatches[network]?.[batchIndex] || []
    }

    getInitializedBatches(network: Network) {
        return Object.keys(this.v3PoolBatches[network] || {}).length
    }

    tryResetCurrentIndex(network: Network) {
        const currentIndex = this.getCurrentIndex(network)
        const pairs = tokenPairs[ChainKey.Solana][network]
        if (!pairs.length) {
            throw new Error(`Pairs is not loaded for ${network}`)
        }
        if (currentIndex >= pairs.length) {
            this.setCurrentIndex(network, 0)
        }
    }

    nextCurrentIndex(network: Network) {
        if (typeof this.currentIndex[network] === "undefined") {
            this.currentIndex[network] = 0
        }
        const currentIndex = this.getCurrentIndex(network)
        this.setCurrentIndex(network, currentIndex + 1)
    }
}
