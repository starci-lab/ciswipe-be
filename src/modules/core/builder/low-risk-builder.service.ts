import { Injectable, OnModuleInit } from "@nestjs/common"
import { BuildStrategyResult, RiskType } from "./types"
import {
    LendingStorageService,
    StakingStorageService,
} from "@/modules/plugins"

// low risk strategy builder
// 1. Stablecoin lending (Aave, Compound, Kamino) -> base yield 3-6%
// 2. Staked ETH/LST (Lido, JitoSOL, Marinade) -> ~4-7%
// 3. Stablecoin pools (Curve 3pool, Saber, Mercurial) -> ~4-8%
// 4. Delta-neutral farming (hedged yield farming) -> 6-10
// 5. Stablecoin liquidity pools (Uniswap v3 stable pairs, Curve factory pools, Raydium stables) -> ~5-10%

@Injectable()
export class LowRiskBuilderService implements OnModuleInit {
    constructor(
    private readonly lendingStorageService: LendingStorageService,
    private readonly stakingStorageService: StakingStorageService,
    ) {}

    async onModuleInit() {
        await this.build()
    }

    async build() {
    // retrieve all plugins
        const lendingPlugins = this.lendingStorageService.getPlugins()
        const stakingPlugins = this.stakingStorageService.getPlugins()
        // since lending fit for this strategy, we will try to build a lending strategy

        return {
            risk: RiskType.LowRisk,
        }
    }

    // we try to simulate a simple lending strategy
    async buildSimpleLendingStrategies(): Promise<Array<BuildStrategyResult>> {
        const lendingPlugins = this.lendingStorageService.getPlugins()
        return []
    }
}
