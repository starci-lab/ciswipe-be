import { Injectable } from "@nestjs/common"
import { JitoPoolStats } from "./jito-api.service"
import { LevelHelpersService } from "@/modules/databases"
import { Network, StrategyAnalysis } from "@/modules/common"

export interface JitoData {
    analysis: StrategyAnalysis;
}

export interface JitoData {
  poolStats: JitoPoolStats;
}

const JITO_KEY = "jito"

@Injectable()
export class JitoStakingLevelService {
    constructor(private levelHelpersService: LevelHelpersService) {}

    async getJitoData(
        network: Network, 
        action: () => Promise<JitoData>
    ) {
        const jitoData =
      await this.levelHelpersService.getOrFetchFromLevel<JitoData>({
          network,
          levelKey: JITO_KEY,
          action,
      })
        return jitoData
    }

    async setJitoData(network: Network, jitoData: JitoData) {
        await this.levelHelpersService.setLevelDbData({
            network,
            levelKey: JITO_KEY,
            data: jitoData,
        })
    }
}
