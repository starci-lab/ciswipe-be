// lowest layer to interact with level db
import { Injectable } from "@nestjs/common"
import { Network, StrategyAnalysis, StrategyRewards } from "@/modules/common"
import { LevelHelpersService } from "@/modules/databases"
import { WithAddressAndStats } from "./solend-rpc.service"
import { HistoricalInterestRateItem, Market } from "./solend-api.service"
import { Reserve } from "./schema"

export interface LendingReserve {
  reserve: WithAddressAndStats<Reserve>;
  rewards: StrategyRewards;
}

export interface LendingReserveMetadata {
  metricsHistory: Array<HistoricalInterestRateItem>;
  strategyAnalysis: StrategyAnalysis;
}
export interface LendingPool {
  market: Market;
  reserves: Array<LendingReserve>;
}

export interface LendingPoolsData {
  pools: Array<LendingPool>;
  currentIndex: number;
}

const LENDING_POOLS_DATA_KEY = "lending-pools-data"
const LENDING_RESERVE_METADATA_KEY = "lending-reserve-metadata"

@Injectable()
export class SolendLendingLevelService {
    constructor(private readonly levelHelpersService: LevelHelpersService) {}

    public async getLendingPoolsData(
        network: Network,
        action?: () => Promise<LendingPoolsData | null>,
    ) {
        const key = this.levelHelpersService.createKey(
            LENDING_POOLS_DATA_KEY,
            network,
        )
        if (action) {
            return this.levelHelpersService.getOrFetchFromLevel({
                levelKey: key,
                network,
                action,
            })
        }
        return this.levelHelpersService.fetchFromLevel<LendingPoolsData>({
            levelKey: key,
            network,
        })
    }

    public async setLendingPoolsData(
        network: Network,
        lendingPoolsData: LendingPoolsData,
    ) {
        const key = this.levelHelpersService.createKey(
            LENDING_POOLS_DATA_KEY,
            network,
        )
        await this.levelHelpersService.setLevelDbData({
            levelKey: key,
            network,
            data: lendingPoolsData,
        })
    }

    public async setLendingReserveMetadata(
        network: Network,
        reserveAddress: string,
        lendingReserveMetadata: LendingReserveMetadata,
    ) {
        const key = this.levelHelpersService.createKey(
            LENDING_RESERVE_METADATA_KEY,
            network,
            reserveAddress,
        )
        await this.levelHelpersService.setLevelDbData({
            levelKey: key,
            network,
            data: lendingReserveMetadata,
        })
    }

    public async getLendingReserveMetadata(
        network: Network,
        reserveAddress: string,
        action?: () => Promise<LendingReserveMetadata | null>,
    ) {
        const key = this.levelHelpersService.createKey(
            LENDING_RESERVE_METADATA_KEY,
            network,
            reserveAddress,
        )
        if (action) {
            return this.levelHelpersService.getOrFetchFromLevel({
                levelKey: key,
                network,
                action,
            })
        }
        return this.levelHelpersService.fetchFromLevel<LendingReserveMetadata>({
            levelKey: key,
            network,
        })
    }

    public async increaseCurrentIndex(network: Network) {
        const lendingPoolsData = await this.getLendingPoolsData(network)
        if (!lendingPoolsData) return
        lendingPoolsData.currentIndex++
        await this.setLendingPoolsData(network, lendingPoolsData)
    }
}
