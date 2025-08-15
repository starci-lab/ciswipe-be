import { Injectable } from "@nestjs/common"
import { Network } from "@/modules/common"
import { ApiV3PoolInfoBaseItem } from "@raydium-io/raydium-sdk-v2"

export interface PoolBatch {
    pools: Array<ApiV3PoolInfoBaseItem>;
    currentLineIndex: number;
}

export interface PoolLine {
    liquidity: number;
    price: number;
    tick: number;
}

export interface PoolLines {
    poolId: string;
    lines: Array<PoolLine>;
}

export interface GlobalData {
    currentIndex: number
}

@Injectable()
export class RaydiumIndexerService {
    // current index for load pools
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }
    // current index for load lines index
    private currentLineIndex: Record<Network, Record<number, number>> = {
        [Network.Mainnet]: {},
        [Network.Testnet]: {},
    }
    private v3PoolBatches: Record<Network, Array<Array<ApiV3PoolInfoBaseItem>>> = {
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

    getCurrentLineIndex(network: Network, batchIndex: number) {
        if (typeof this.currentLineIndex[network][batchIndex] === "undefined") {
            this.currentLineIndex[network][batchIndex] = 0
        }
        return this.currentLineIndex[network][batchIndex]
    }

    setCurrentLineIndex(network: Network, batchIndex: number, lineIndex: number) {
        if (!this.currentLineIndex[network]) {
            this.currentLineIndex[network] = {}
        }
        this.currentLineIndex[network][batchIndex] = lineIndex
    }

    nextLineIndex(network: Network, batchIndex: number) {
        if (!this.currentLineIndex[network]) {
            this.currentLineIndex[network] = {}
        }
        if (typeof this.currentLineIndex[network][batchIndex] === "undefined") {
            this.currentLineIndex[network][batchIndex] = 0
        }
        this.currentLineIndex[network][batchIndex]++
    }

    getV3PoolBatches(network: Network) {
        return this.v3PoolBatches[network]
    }

    setV3PoolBatch(network: Network, batchIndex: number, pools: Array<ApiV3PoolInfoBaseItem>) {
        if (!this.v3PoolBatches[network]) {
            this.v3PoolBatches[network] = []
        }
        this.v3PoolBatches[network][batchIndex] = pools
    }

    getV3PoolBatch(network: Network, batchIndex: number) {
        return this.v3PoolBatches[network]?.[batchIndex]
    }

    getAllCurrentLineIndexes(network: Network) {
        return this.currentLineIndex[network] || {}
    }

    // findNextUnloadedLineIndex(network: Network): [number, number] | null {
    //     const v3PoolBatches = this.getV3PoolBatches(network)
    //     if (!v3PoolBatches.length) {
    //         this.logger.debug(`Batch is not loaded for ${network}`)
    //         return null
    //     }
    //     for (
    //         let batchIndex = 0;
    //         batchIndex < v3PoolBatches.length;
    //         batchIndex++
    //     ) {
    //         const lineIndex = this.indexerService.getCurrentLineIndex(network, batchIndex)
    //         if (lineIndex < v3PoolBatches[batchIndex].length) {
    //             if (!v3PoolBatches[batchIndex][lineIndex]) {
    //                 throw new Error(
    //                     `Pool is not loaded for ${network} at batch index ${batchIndex} and line index ${lineIndex}`,
    //                 )
    //             }
    //             return [batchIndex, lineIndex]
    //         }
    //     }
    //     // we will increase the index to the next batch
    //     this.logger.debug(`All lines loaded for ${network}`)
    //     return null
    // }
}
