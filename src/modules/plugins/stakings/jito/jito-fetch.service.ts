import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { Network } from "@/modules/common"
import { JitoStakingLevelService } from "./jito-level.service"
import { JitoStakingCacheService } from "./jito-cache.service"
import { JitoStakingApiService } from "./jito-api.service"
import { LockService } from "@/modules/misc"
import { RegressionService } from "@/modules/probability-statistics"
//import dayjs from "dayjs"

export const LOCK_KEYS = {
    JITO_DATA: "jito_data",
}

@Injectable()
export class JitoStakingFetchService implements OnModuleInit {
    private logger = new Logger(JitoStakingFetchService.name)
    constructor(
        private readonly jitoLevelService: JitoStakingLevelService,
        private readonly jitoCacheService: JitoStakingCacheService,
        private readonly jitoApiService: JitoStakingApiService,
        private readonly lockService: LockService,
        private readonly regressionService: RegressionService,
    ) {}

    async onModuleInit() {
        await this.fetchJitoData(Network.Mainnet)
    }   

    async fetchJitoData(
        network: Network
    ): Promise<void> {
        await this.lockService.withLocks({
            blockedKeys: [LOCK_KEYS.JITO_DATA],
            acquiredKeys: [LOCK_KEYS.JITO_DATA],
            releaseKeys: [LOCK_KEYS.JITO_DATA],
            network,
            callback: async () => {
                if (network === Network.Testnet) {
                    this.logger.warn("Jito is not supported on testnet")
                    return
                }
                try {
                    // const jitoData = await this.jitoLevelService.getJitoData(
                    //     network, 
                    //     async () => {
                    //         const jitoData = await this.jitoApiService.getPoolStats()
                    //         return {
                    //             poolStats: jitoData,
                    //             analysis: this.computeRegression(jitoData.getStakePoolStats.apy),
                    //         }
                    //     })
                    // await this.jitoCacheService.cacheJitoData(network, jitoData)
                } catch (error) {
                    this.logger.error(
                        `Cannot load jito data for ${network}, message: ${error.message}`,
                    )
                }
            }
        })
    }

    // private computeRegression(apy: Array<JitoDataPoint>) {
    //     const apySamples: Array<Point> = apy.map(
    //         (apy) => ({
    //             x: dayjs(apy.date).unix(),
    //             y: Number(apy.data),
    //         }),
    //     )
    // }
}