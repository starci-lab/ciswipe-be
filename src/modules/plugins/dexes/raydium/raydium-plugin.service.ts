import {
    InterestRateConverterService,
    TokenUtilsService,
} from "@/modules/blockchain"
import {
    DexPluginAbstract,
    V3ExecuteParams,
    V3ExecuteSingleParams,
} from "../abstract"
import { Injectable, OnModuleInit } from "@nestjs/common"
import {
    ChainKey,
    combinations,
    StrategyResult,
    TokenType,
} from "@/modules/common"
import { tokens } from "@/modules/blockchain"
import { Decimal } from "decimal.js"
import { RaydiumLevelService } from "./raydium-level.service"
import { RaydiumInitService } from "./raydium-init.service"

@Injectable()
export class RaydiumPluginService
    extends DexPluginAbstract
    implements OnModuleInit
{
    constructor(
    private readonly raydiumLevelService: RaydiumLevelService,
    private readonly interestRateConverterService: InterestRateConverterService,
    private readonly raydiumInitService: RaydiumInitService,
    private readonly tokenUtilsService: TokenUtilsService,
    ) {
        super({
            name: "Raydium",
            icon: "https://raydium.io/favicon.ico",
            url: "https://raydium.io",
            description: "Raydium is a decentralized exchange on Solana.",
            tags: ["dex"],
            chainKeys: [ChainKey.Solana],
        })
    }

    async onModuleInit() {
        await this.raydiumInitService.loadAllOnInit()
    }

    private async v3ExecuteSingle({
        network,
        chainKey,
        inputTokens,
    }: V3ExecuteSingleParams): Promise<Array<StrategyResult>> {
        if (inputTokens.length !== 2) {
            throw new Error("Raydium add liquidity v3 only supports 2 input tokens")
        }
        // get the pool info
        const [token1, token2] = inputTokens
        if (token1.id === token2.id) {
            throw new Error(
                "Raydium add liquidity v3 only supports 2 different input tokens",
            )
        }
        // get the token info
        const token1Entity = tokens[chainKey][network].find(
            (token) => token.id === token1.id,
        )
        const token2Entity = tokens[chainKey][network].find(
            (token) => token.id === token2.id,
        )
        if (!token1Entity || !token2Entity) {
            throw new Error("Raydium token not found")
        }
        if (token1Entity.type === TokenType.Native) {
            const wrapper = tokens[chainKey][network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
        }
        if (token2Entity.type === TokenType.Native) {
            const wrapper = tokens[chainKey][network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!wrapper) {
                throw new Error("Raydium wrapper token not found")
            }
        }
        const index = this.tokenUtilsService.getIndexByPair({
            token0: token1Entity.id,
            token1: token2Entity.id,
            chainKey,
            network,
        })
        const poolBatch = await this.raydiumLevelService.getPoolBatch(
            network,
            index,
        )
        if (!poolBatch) {
            throw new Error("Raydium pool batch not found")
        }

        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const pool of poolBatch.pools.map((pool) => pool.pool)) {
            promises.push(
                (async () => {
                    const poolLines = await this.raydiumLevelService.getPoolLines(
                        network,
                        pool.id,
                    )
                    if (!poolLines) {
                        return
                    }
                    results.push({
                        outputTokens: {
                            tokens: [],
                        },
                        metadata: {
                            poolId: pool.id,
                            feeRate: pool.feeRate,
                            tvl: pool.tvl,
                            openTime: pool.openTime,
                        },
                        rewards: {
                            rewardTokens: pool.rewardDefaultInfos.map((info) => ({
                                token: {
                                    id: info.mint.address,
                                    name: info.mint.name,
                                    symbol: info.mint.symbol,
                                    decimals: info.mint.decimals,
                                    icon: info.mint.logoURI,
                                },
                            })),
                        },
                        yieldSummary: {
                            aprs: {
                                base: pool.day.apr,
                                day: pool.day.apr,
                                week: pool.week.apr,
                                month: pool.month.apr,
                            },
                            apys: {
                                base: this.interestRateConverterService
                                    .toAPY(new Decimal(pool.day.apr), chainKey, network)
                                    .toNumber(),
                                day: this.interestRateConverterService
                                    .toAPY(new Decimal(pool.day.apr), chainKey, network)
                                    .toNumber(),
                                week: this.interestRateConverterService
                                    .toAPY(new Decimal(pool.week.apr), chainKey, network)
                                    .toNumber(),
                                month: this.interestRateConverterService
                                    .toAPY(new Decimal(pool.month.apr), chainKey, network)
                                    .toNumber(),
                            },
                        },
                    })
                })(),
            )
        }
        await Promise.all(promises)
        return results
    }

    // method to add liquidity to a pool
    protected async v3Execute({
        network,
        chainKey,
        inputTokens,
    }: V3ExecuteParams): Promise<Array<StrategyResult>> {
        const tokenPairs = combinations(inputTokens, 2)
        const results: Array<StrategyResult> = []
        const promises: Array<Promise<void>> = []
        for (const tokenPair of tokenPairs) {
            promises.push(
                (async () => {
                    const results = await this.v3ExecuteSingle({
                        network,
                        chainKey,
                        inputTokens: tokenPair,
                    })
                    results.push(...results)
                })(),
            )
        }
        await Promise.all(promises)
        return results
    }
}
