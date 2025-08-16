import { Injectable, Logger } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import { tokenPairs } from "@/modules/blockchain"
import { ApiV3PoolInfoBaseItem } from "@raydium-io/raydium-sdk-v2"
import { PoolBatch } from "./raydium-level.service"

@Injectable()
export class RaydiumIndexerService {
    private logger = new Logger(RaydiumIndexerService.name)
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

    private v3PoolBatches: Record<Network, Array<Array<ApiV3PoolInfoBaseItem>>> =
        {
            [Network.Mainnet]: [],
            [Network.Testnet]: [],
        }

    getCurrentIndex(network: Network) {
        return this.currentIndex[network] || 0
    }

    setCurrentIndex(network: Network, batchIndex: number) {
        this.currentIndex[network] = batchIndex
    }
    nextCurrentIndex(network: Network) {
        if (typeof this.currentIndex[network] === "undefined") {
            this.currentIndex[network] = 0
        }
        const currentIndex = this.getCurrentIndex(network)
        this.setCurrentIndex(network, currentIndex + 1)
    }

    getCurrentLineIndex(network: Network, batchIndex: number) {
        return this.currentLineIndex[network]?.[batchIndex] || 0
    }

    setCurrentLineIndex(
        network: Network,
        batchIndex: number,
        lineIndex?: number,
    ) {
        if (!this.currentLineIndex[network]) {
            this.currentLineIndex[network] = {}
        }
        this.currentLineIndex[network][batchIndex] = lineIndex
    }

    setV3PoolBatchAndCurrentLineIndex(
        network: Network,
        batchIndex: number,
        poolBatch: PoolBatch,
    ) {
        this.setV3PoolBatch(
            network,
            batchIndex,
            poolBatch.pools.map((pool) => pool.pool),
        )
        this.setCurrentLineIndex(network, batchIndex, poolBatch.currentLineIndex)
    }

    resetCurrentLineIndex(network: Network, batchIndex: number) {
        if (!this.currentLineIndex[network]) {
            this.currentLineIndex[network] = {}
        }
        this.currentLineIndex[network][batchIndex] = undefined
    }

    nextCurrentLineIndex(network: Network, batchIndex: number) {
        const currentLineIndex = this.getCurrentLineIndex(network, batchIndex)
        this.setCurrentLineIndex(network, batchIndex, currentLineIndex + 1)
    }

    getV3PoolBatches(network: Network) {
        return this.v3PoolBatches[network] || []
    }

    setV3PoolBatch(
        network: Network,
        batchIndex: number,
        pools: Array<ApiV3PoolInfoBaseItem>,
    ) {
        if (!this.v3PoolBatches[network]) {
            this.v3PoolBatches[network] = []
        }
        this.v3PoolBatches[network][batchIndex] = pools
    }

    getV3PoolBatch(network: Network, batchIndex: number) {
        return this.v3PoolBatches[network]?.[batchIndex] || []
    }

    getAllCurrentLineIndexes(network: Network) {
        return Object.values(this.currentLineIndex[network] || {}).map(
            (index) => index,
        )
    }

    getInitializedBatches(network: Network) {
        return Object.keys(this.v3PoolBatches[network] || {}).length
    }

    findNextUnloadedLineIndex(network: Network): [number, number] | null {
        const v3PoolBatches = this.getV3PoolBatches(network)
        if (!v3PoolBatches.length) {
            this.logger.debug(`Batch is not loaded for ${network}`)
            return null
        }
        for (let batchIndex = 0; batchIndex < v3PoolBatches.length; batchIndex++) {
            if (!v3PoolBatches[batchIndex]?.length) {
                this.logger.debug(
                    `Batch is not loaded for ${network} at batch index ${batchIndex}, maybe same keys, skip...`,
                )
                continue
            }
            const lineIndex = this.getCurrentLineIndex(network, batchIndex)
            console.log(lineIndex)
            if (lineIndex < v3PoolBatches[batchIndex].length) {
                if (!v3PoolBatches[batchIndex][lineIndex]) {
                    throw new Error(
                        `Pool is not loaded for ${network} at batch index ${batchIndex} and line index ${lineIndex}`,
                    )
                }
                return [batchIndex, lineIndex]
            }
        }
        // we will increase the index to the next batch
        this.logger.debug(`All lines loaded for ${network}`)
        return null
    }

    resetCurrentLineIndexes(network: Network) {
    // when reset, we will change all line index to undefined
        for (const batchIndex of Object.keys(this.currentIndex[network] || {})) {
            this.resetCurrentLineIndex(network, Number.parseInt(batchIndex))
        }
    }

    tryResetCurrentIndex(network: Network) {
        const currentIndex = this.getCurrentIndex(network)
        const pairs = tokenPairs[ChainKey.Solana][network]
        if (!pairs.length) {
            throw new Error(`Pairs is not loaded for ${network}`)
        }
        if (currentIndex >= pairs.length) {
            this.resetCurrentLineIndexes(network)
            this.setCurrentIndex(network, 0)
        }
    }
}
