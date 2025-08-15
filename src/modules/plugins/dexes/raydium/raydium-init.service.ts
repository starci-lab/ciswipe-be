import { Injectable, Logger, Inject } from "@nestjs/common"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { Network, ChainKey } from "@/modules/common"
import { VolumeService } from "@/modules/volume"
import { createCacheKey } from "@/modules/cache"
import { Token, tokenPairs } from "@/modules/blockchain"
import { PoolBatch, PoolLines, GlobalData, RaydiumIndexerService } from "./raydium-indexer.service"
import { FOLDER_NAMES } from "./constants"

@Injectable()
export class RaydiumInitService {
    private logger = new Logger(RaydiumInitService.name)

    constructor(
        private readonly volumeService: VolumeService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly indexerService: RaydiumIndexerService,
    ) {}

    public getPoolBatchCacheKey(network: Network, token1: string, token2: string) {
        [token1, token2] = this.ensureTokensOrder(token1, token2)
        return createCacheKey("pool-batch", {
            network,
            token1,
            token2,
        })
    }

    public getPoolLinesCacheKey(network: Network, poolId: string) {
        return createCacheKey("pool-lines", {
            network,
            poolId,
        })
    }

    private ensureTokensOrder(token1: string, token2: string) {
        if (Buffer.byteLength(token1) > Buffer.byteLength(token2)) {
            [token1, token2] = [token2, token1]
        }
        return [token1, token2]
    }

    public getPoolBatchVolumeKey(network: Network, token1: string, token2: string) {
        [token1, token2] = this.ensureTokensOrder(token1, token2)
        return `pool-batch-${network}-${token1}-${token2}.json`
    }

    public getPoolLinesVolumeKey(network: Network, poolId: string) {
        return `pool-lines-${network}-${poolId}.json`
    }

    public getGlobalDataVolumeKey(network: Network) {
        return `global-data-${network}.json`
    }

    private async loadAndCachePoolBatchFromVolume(
        network: Network,
        token1: Token, 
        token2: Token
    ) {
        const poolBatchVolumeName = this.getPoolBatchVolumeKey(network, token1.id, token2.id)
        if (!await this.volumeService.existsInDataVolume({
            name: poolBatchVolumeName,
            folderNames: FOLDER_NAMES,
        })) return null
        const poolBatch = await this.volumeService.readJsonFromDataVolume<PoolBatch>({
            name: poolBatchVolumeName,
            folderNames: FOLDER_NAMES,
        })
        await this.cacheManager.set(
            this.getPoolBatchCacheKey(network, token1.id, token2.id),
            poolBatch
        )
        return poolBatch
    }
    
    private async loadAndCachePoolLinesFromVolume(network: Network, poolId: string) {
        if (!poolId) return
        const lineBatchVolumeName = this.getPoolLinesVolumeKey(network, poolId)
        if (!await this.volumeService.existsInDataVolume({
            name: lineBatchVolumeName,
            folderNames: FOLDER_NAMES,
        })) return
    
        const lines = await this.volumeService.readJsonFromDataVolume<PoolLines>({
            name: lineBatchVolumeName,
            folderNames: FOLDER_NAMES,
        })
        await this.cacheManager.set(
            this.getPoolLinesCacheKey(network, poolId),
            lines
        )
    }
    
    async cacheAllOnInit() {
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue
            const pairs = tokenPairs[ChainKey.Solana][network] || []
            const promises: Array<Promise<void>> = []
            for (let index = 0; index < this.indexerService.getCurrentIndex(network); index++) {
                promises.push(
                    (async () => {
                        const [token1, token2] = pairs[index] || []
                        if (!token1 || !token2) return
                        const poolBatch = await this.loadAndCachePoolBatchFromVolume(network, token1, token2)
                        if (!poolBatch?.pools) return
                        const internalPromises: Array<Promise<void>> = []  
                        for (const pool of poolBatch.pools) {   
                            internalPromises.push(
                                this.loadAndCachePoolLinesFromVolume(network, pool.id)
                            )
                        }
                        await Promise.all(internalPromises)
                    })()
                )
                await Promise.all(promises)
            }
        }
    }

    async loadGlobalData(network: Network) {
        try {
            const { currentIndex } = await this.volumeService.tryActionOrFallbackToVolume<GlobalData>({
                name: this.getGlobalDataVolumeKey(network),
                action: async () => {
                    return {
                        currentIndex: 0,
                    }
                },
                folderNames: FOLDER_NAMES,
            })
            this.indexerService.setCurrentIndex(network, currentIndex)
        } catch (error) {
            this.logger.error(`Cannot load global data for ${network}, message: ${error.message}`)
            return { currentIndex: 0 }
        }
    }
}
