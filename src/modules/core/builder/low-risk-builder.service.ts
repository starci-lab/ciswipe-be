import { Injectable, OnModuleInit } from "@nestjs/common"
import { BuildStrategyResult, StrategyQuoteRequest } from "./types"
import {
    LendingStorageService,
    StakingStorageService,
    VaultStorageService,
} from "@/modules/plugins"
import { ChainKey, Network } from "@/modules/common"
import { tokens } from "@/modules/blockchain/tokens"
import { randomUUID } from "crypto"
import { getIntersection } from "@/modules/common"
import { ScoringService } from "../scoring"
import { RiskType } from "../types"

// low risk strategy builder
// 1. Stablecoin lending (Aave, Compound, Kamino) -> base yield 3-6%
// 2. Staked ETH/LST (Lido, JitoSOL, Marinade) -> ~4-7%
// 3. Stablecoin pools (Curve 3pool, Saber, Mercurial) -> ~4-8%
// 4. Delta-neutral farming (hedged yield farming) -> 6-10
// 5. Stablecoin liquidity pools (Uniswap v3 stable pairs, Curve factory pools, Raydium stables) -> ~5-10%
// 6. Vaults (Kamino, Jupiter, Raydium) -> ~10-20%

@Injectable()
export class LowRiskBuilderService implements OnModuleInit {
    constructor(
        private readonly lendingStorageService: LendingStorageService,
        private readonly stakingStorageService: StakingStorageService,
        private readonly vaultStorageService: VaultStorageService,
        private readonly scoringService: ScoringService,
    ) { }

    async onModuleInit() {
        await this.build()
    }

    async build() {
        // retrieve all plugins
        //const lendingPlugins = this.lendingStorageService.getPlugins()
        //const stakingPlugins = this.stakingStorageService.getPlugins()
        //const vaultPlugins = this.vaultStorageService.getPlugins()
        // since lending fit for this strategy, we will try to build a lending strategy

        return this.buildSimpleVaultStrategies({
            chainKeys: [ChainKey.Solana],
            riskTypes: [RiskType.LowRisk],
            network: Network.Mainnet,
        })
    }

    // we try to simulate a simple lending strategy
    async buildSimpleVaultStrategies({
        chainKeys,
        network = Network.Mainnet,
    }: StrategyQuoteRequest): Promise<Array<BuildStrategyResult>> {
        const vaultPlugins = this.vaultStorageService.getPlugins()
        const results: Array<BuildStrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const plugin of vaultPlugins) {
            promises.push(
                (async () => {
                    const intersectionChainKeys = getIntersection(chainKeys, plugin.getChainKeys())
                    if (intersectionChainKeys.length === 0) {
                        return
                    }
                    const internalPromises: Array<Promise<void>> = []
                    for (const chainKey of intersectionChainKeys) {
                        const tokenIds = getIntersection(
                            tokens[chainKey][network].map((token) => token.id),
                            plugin.getTokenIds()[network],
                        )
                        if (tokenIds.length === 0) {
                            continue
                        }
                        internalPromises.push(
                            (async () => {
                                const data = await plugin.execute({
                                    network,
                                    chainKey,
                                    inputTokens: tokenIds.map((tokenId) => ({
                                        id: tokenId,
                                    })),
                                })
                                const internalResults: Array<BuildStrategyResult> =
                                    data.map((strategy) => ({
                                        id: randomUUID(),
                                        allocations: [
                                            {
                                                allocation: 100,
                                                steps: [{
                                                    strategy,
                                                    score: this.scoringService.score(
                                                        {
                                                            chainKey,
                                                            network,
                                                            strategy,
                                                            riskType: RiskType.LowRisk,
                                                        },
                                                    ),
                                                }],
                                            },
                                        ],
                                    }))
                                results.push(...internalResults)
                            })(),
                        )
                    }
                    await Promise.all(internalPromises)
                })(),
            )
        }
        await Promise.all(promises)
        return results
    }
}
