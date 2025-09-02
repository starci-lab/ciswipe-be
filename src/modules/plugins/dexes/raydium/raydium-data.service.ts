// lowest layer to interact with level db
import { Injectable } from "@nestjs/common"
import { ChainKey, Network, PluginProtocolName } from "@/modules/common"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { ApiV3PoolInfoBaseItem } from "@raydium-io/raydium-sdk-v2"
import { LiquidityLine, PositionLine } from "./raydium-api.service"
import {
    InjectMongoose,
    MongooseStorageHelpersService,
    StorageSchema,
} from "@/modules/databases"
import { Connection } from "mongoose"

// we track pool batch for each pool
export interface PoolBatch {
  pools: Array<PoolData>;
  // we track current line index for each pool to continue loading lines
  currentLineIndex: number;
}

// we track pool data for each pool
export interface PoolData {
  pool: ApiV3PoolInfoBaseItem;
}

// we track position and liquidity lines for each pool
export interface PoolLines {
  poolId: string;
  positionLines: Array<PositionLine>;
  liquidityLines: Array<LiquidityLine>;
}

// we track global data for all pools
export interface GlobalData {
  // we track current index to continue loading pools
  currentIndex: number;
}

const GLOBAL_DATA_KEY = "global-data"
const POOL_BATCH_KEY = "pool-batch"
const POOL_LINES_KEY = "pool-lines"

@Injectable()
export class RaydiumDexDataService {
    constructor(
    @InjectMongoose()
    private readonly connection: Connection,
    private readonly tokenUtilsService: TokenUtilsService,
    private readonly mongooseStorageHelpersService: MongooseStorageHelpersService,
    ) {}

    private getPoolBatchKey(network: Network, batchIndex: number) {
        const [token0, token1] = this.tokenUtilsService.getPairsWithoutNativeToken(
            ChainKey.Solana,
            network,
        )[batchIndex]
        return `${POOL_BATCH_KEY}-${token0.id}-${token1.id}-${batchIndex}`
    }

    private getPoolLinesKey(poolId: string) {
        return `${POOL_LINES_KEY}-${poolId}`
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
            protocolName: PluginProtocolName.DexRaydium,
        })
    }

    // get pool lines from mongoose
    public async getPoolLines(
        network: Network,
        poolId: string,
        action?: () => Promise<PoolLines | null>,
    ): Promise<PoolLines | null> {
        const poolLinesKey = this.getPoolLinesKey(poolId)
        return this.mongooseStorageHelpersService.getOrFetchStorage({
            key: poolLinesKey,
            action,
            network,
            protocolName: PluginProtocolName.DexRaydium,
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
            protocolName: PluginProtocolName.DexRaydium,
        })
    }

    // upsert
    public async upsertPoolLines(
        network: Network,
        poolId: string,
        poolLines: PoolLines,
    ) {
        const poolLinesKey = this.getPoolLinesKey(poolId)
        return await this.mongooseStorageHelpersService.upsertStorage({
            key: poolLinesKey,
            network,
            data: poolLines,
            protocolName: PluginProtocolName.DexRaydium,
        })
    }

    // set global data to mongoose
    public async upsertGlobalData(network: Network, globalData: GlobalData) {
        const globalDataKey = this.getGlobalDataKey()
        return await this.mongooseStorageHelpersService.upsertStorage({
            key: globalDataKey,
            network,
            data: globalData,
            protocolName: PluginProtocolName.DexRaydium,
        })
    }

    public async initGlobalData(network: Network) {
        const defaultGlobalData: GlobalData = {
            currentIndex: 0,
        }
        const globalDataKey = this.getGlobalDataKey()
        await this.mongooseStorageHelpersService.upsertStorage({
            key: globalDataKey,
            network,
            data: defaultGlobalData,
            protocolName: PluginProtocolName.DexRaydium,
        })
        return defaultGlobalData
    }

    // get global data from level db
    public async getGlobalData(network: Network): Promise<GlobalData | null> {
        const globalDataKey = this.getGlobalDataKey()
        const storage =
      await this.mongooseStorageHelpersService.getStorage<GlobalData>({
          key: globalDataKey,
          network,
          protocolName: PluginProtocolName.DexRaydium,
      })
        if (!storage) {
            throw new Error(`Global data not found for ${network}`)
        }
        return storage
    }

    public async increaseCurrentIndex(network: Network) {
        await this.connection.model<StorageSchema>(StorageSchema.name).updateOne(
            {
                displayId: this.mongooseStorageHelpersService.createDisplayId(
                    this.getGlobalDataKey(),
                    PluginProtocolName.DexRaydium,
                    network,
                ),
            },
            { $inc: { "data.currentIndex": 1 } },
        )
    }

    public async increaseLineIndex(network: Network, batchIndex: number) {
        await this.connection
            .model<StorageSchema>(StorageSchema.name)
            .updateOne(
                {
                    displayId: this.mongooseStorageHelpersService.createDisplayId(
                        this.getPoolBatchKey(network, batchIndex),
                        PluginProtocolName.DexRaydium,
                        network,
                    ),
                },
                { $inc: { "data.currentLineIndex": 1 } },
            )
    }
}
