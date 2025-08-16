// lowest layer to interact with level db
import { Injectable } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import { TokenUtilsService } from "@/modules/blockchain/tokens"
import { LevelHelpersService } from "@/modules/databases"
import { ApiV3PoolInfoBaseItem } from "@raydium-io/raydium-sdk-v2"
import { LiquidityLine, PositionLine } from "./raydium-api.service"

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
export class RaydiumLevelService {
    constructor(
    private readonly levelHelpersService: LevelHelpersService,
    private readonly tokenUtilsService: TokenUtilsService,
    ) {}

    // get pool batch from level db
    public async getPoolBatch(
        network: Network,
        batchIndex: number,
        action?: () => Promise<PoolBatch | null>,
    ): Promise<PoolBatch | null> {
        const [token0, token1] = this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)[batchIndex] || []
        const key = this.tokenUtilsService.createKey(
            POOL_BATCH_KEY,
            token0.id,
            token1.id,
        )
        if (action) {
            return this.levelHelpersService.getOrFetchFromLevel({
                levelKey: key,
                network,
                action,
            })
        }
        return this.levelHelpersService.fetchFromLevel({
            levelKey: key,
            network,
        })
    }

    // get pool lines from level db
    public async getPoolLines(
        network: Network,
        poolId: string,
        action?: () => Promise<PoolLines | null>,
    ): Promise<PoolLines | null> {
        const key = this.tokenUtilsService.createKey(POOL_LINES_KEY, poolId)
        if (action) {
            return this.levelHelpersService.getOrFetchFromLevel({
                levelKey: key,
                network,
                action,
            })
        }
        return this.levelHelpersService.fetchFromLevel({
            levelKey: key,
            network,
        })
    }

    // set pool batch to level db
    public async setPoolBatch(
        network: Network,
        batchIndex: number,
        poolBatch: PoolBatch,
    ) {
        const [token0, token1] = this.tokenUtilsService.getPairsWithoutNativeToken(ChainKey.Solana, network)[batchIndex]
        const key = this.tokenUtilsService.createKey(
            POOL_BATCH_KEY,
            token0.id,
            token1.id,
        )
        return await this.levelHelpersService.setLevelDbData({
            levelKey: key,
            network,
            data: poolBatch,
        })
    }

    // set pool lines to level db
    public async setPoolLines(
        network: Network,
        poolId: string,
        poolLines: PoolLines,
    ) {
        const key = this.tokenUtilsService.createKey(POOL_LINES_KEY, poolId)
        return await this.levelHelpersService.setLevelDbData({
            levelKey: key,
            network,
            data: poolLines,
        })
    }

    // set global data to level db
    public async setGlobalData(network: Network, globalData: GlobalData) {
        const key = this.tokenUtilsService.createKey(GLOBAL_DATA_KEY)
        return await this.levelHelpersService.setLevelDbData({
            levelKey: key,
            network,
            data: globalData,
        })
    }

    // get global data from level db
    public async getGlobalData(network: Network): Promise<GlobalData | null> {
        const key = this.tokenUtilsService.createKey(GLOBAL_DATA_KEY)
        return await this.levelHelpersService.fetchFromLevel({
            levelKey: key,
            network,
        })
    }

    public async increaseGlobalDataIndex(network: Network) {
        const globalData = await this.getGlobalData(network)
        if (!globalData) {
            return
        }
        globalData.currentIndex++
        await this.setGlobalData(network, globalData)
    }

    public async increaseLineIndex(network: Network, batchIndex: number) {
        const poolBatch = await this.getPoolBatch(network, batchIndex)
        if (!poolBatch) return
        poolBatch.currentLineIndex += 1
        await this.setPoolBatch(network, batchIndex, poolBatch)
    }
}
