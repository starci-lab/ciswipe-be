import {
    Injectable,
    OnModuleInit,
    OnApplicationBootstrap,
} from "@nestjs/common"
import { JitoDataPoint, JitoPoolStats, 
} from "./jito-api.service"
import { ChainKey, Network, StrategyResult } from "@/modules/common"
import { TokenId } from "@/modules/blockchain"
import { ExecuteParams } from "../abstract"
import { StakingPluginAbstract } from "../abstract"
import { JitoStakingCacheService } from "./jito-cache.service"
import { Point, RegressionService } from "@/modules/probability-statistics"
import dayjs from "dayjs"

const DAY = 86400

export interface Data {
  stats: JitoPoolStats;
}

@Injectable()
export class JitoPluginService
    extends StakingPluginAbstract
    implements OnModuleInit, OnApplicationBootstrap
{
    constructor(
        private readonly jitoCacheService: JitoStakingCacheService,
        private readonly regressionService: RegressionService,
    ) {
        super({
            name: "Jito",
            icon: "https://jito.io/favicon.ico",
            url: "https://jito.io",
            description: "Jito is a staking platform on Solana.",
            tags: ["staking"],
            chainKeys: [ChainKey.Solana],
        })
    }

    /** Load Jito SDK per-network */
    async onModuleInit() {}

    async onApplicationBootstrap() {
    // Example: stake SOL to Jito pool and log result
        const result = await this.execute({
            network: Network.Mainnet,
            chainKey: ChainKey.Solana,
            inputTokens: [
                { id: TokenId.SolanaSolMainnet, amount: 1 },
            ],
        })
        console.dir(result, { depth: null })
    }

    /** Stake into Jito */
    protected async execute(
        params: ExecuteParams
    ): Promise<Array<StrategyResult>> {
        try {
            const jitoData = await this.jitoCacheService.getJitoData(params.network)
            // return jitoData.map((data) => ({
            //     network: params.network,
            //     chainKey: params.chainKey,
            //     inputTokens: params.inputTokens,
            //     outputTokens: data.stats.getStakePoolStats.outputTokens,
            //     apy: data.stats.getStakePoolStats.apy,

            // }))
            return []
        } catch (error) {
            console.error(error)
            throw error
        }
    }
}
