import { Injectable } from "@nestjs/common"
import { ChainKey, Network, PluginProtocolName } from "@/modules/common"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { MongooseStorageHelpersService } from "@/modules/databases"
import { OrcaWhirlpool } from "./orca-api.service"

export interface PoolData {
    pool: OrcaWhirlpool;
}
// we track pool batch for each pool
export interface PoolBatch {
    pools: Array<PoolData>;
}

// we track global data for all pools
export interface GlobalData {
    // we track current index to continue loading pools
    currentIndex: number;
}

const GLOBAL_DATA_KEY = "global-data"
const POOL_BATCH_KEY = "pool-batch"

@Injectable()
export class OrcaDexDataService {
    constructor(
        private readonly tokenUtilsService: TokenUtilsService,
        private readonly mongooseStorageHelpersService: MongooseStorageHelpersService,
    ) { }

    private getPoolBatchKey(
        network: Network,
        batchIndex: number
    ) {
        const [token0, token1] = this.tokenUtilsService.getPairsWithoutNativeToken(
            ChainKey.Solana,
            network,
        )[batchIndex]
        return `${POOL_BATCH_KEY}-${token0.id}-${token1.id}-${batchIndex}`
    }

    private getGlobalDataKey() {
        return `${GLOBAL_DATA_KEY}`
    }

    // get pool batch from mongoose
    public async getPoolBatch(
        network: Network,
        batchIndex: number,
        action?: () => Promise<PoolBatch | null>,
    ): Promise<PoolBatch | null> {
        const poolBatchKey = this.getPoolBatchKey(network, batchIndex)
        return this.mongooseStorageHelpersService.getOrFetchStorage({
            key: poolBatchKey,
            action,
            network,
            protocolName: PluginProtocolName.DexOrca,
        })
    }

    // upsert pool batch to mongoose
    public async upsertPoolBatch(
        network: Network,
        batchIndex: number,
        poolBatch: PoolBatch,
    ) {
        const poolBatchKey = this.getPoolBatchKey(network, batchIndex)  
        return await this.mongooseStorageHelpersService.upsertStorage({
            key: poolBatchKey,
            network,
            data: poolBatch,
            protocolName: PluginProtocolName.DexOrca,
        })
    }

    // set global data to mongoose
    public async upsertGlobalData(
        network: Network, 
        globalData: GlobalData
    ) {
        const globalDataKey = this.getGlobalDataKey()
        return await this.mongooseStorageHelpersService.upsertStorage({
            key: globalDataKey,
            network,
            data: globalData,
            protocolName: PluginProtocolName.DexOrca,
        })
    }

    // get global data from level db
    public async getGlobalData(
        network: Network
    ): Promise < GlobalData | null > {
        const globalDataKey = this.getGlobalDataKey()
        const storage = await this.mongooseStorageHelpersService.getStorage<GlobalData>({
            key: globalDataKey,
            network,
            protocolName: PluginProtocolName.DexOrca,
        })
        if (!storage) {
            await this.mongooseStorageHelpersService.upsertStorage({
                key: globalDataKey,
                network,
                data: {
                    currentIndex: 0,
                },
                protocolName: PluginProtocolName.DexOrca,
            })
        }
        return storage
    }

    public async increaseCurrentIndex(network: Network) {
        const globalData = await this.getGlobalData(network)
        if (!globalData) {
            return
        }
        globalData.currentIndex++
        await this.upsertGlobalData(network, globalData)
    }
}
