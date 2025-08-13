import { Injectable } from "@nestjs/common"
import {
    ChainKey,
    Network,
    roundNumber,
    StrategyAnalysisField,
    StrategyResult,
} from "@/modules/common"
import Decimal from "decimal.js"
import { RiskType } from "../types"
import { InterestRateConverterService } from "@/modules/blockchain"

export interface ScoreParams {
    chainKey: ChainKey
    network: Network
    strategy: StrategyResult
    riskType: RiskType
}

@Injectable()
export class ScoringService {
    constructor(
        private readonly interestRateConverterService: InterestRateConverterService,
    ) {}

    /**
   * Scores a strategy based on:
   * - Yield performance (APY/APR) - 60% weight
   * - Statistical confidence - 25% weight
   * - Growth projections - 15% weight
   *
   * APY values get a 1.1x premium over APR
   *
   * @param strategy The strategy result to score
   * @returns Numerical score representing strategy quality (higher is better)
   */
    public score({
        chainKey,   
        network,
        strategy,
        riskType,
    }: ScoreParams): number {
        let score = 0
        score += this.calculateAPYAPRScore(strategy.yieldSummary, chainKey, network, riskType)
        score += this.calculateGrowthScore(strategy.strategyAnalysis, riskType)
        score += this.calculateAIInsightsScore(strategy.strategyAIInsights)
        return roundNumber(score)
    }


    private calculateAPYAPRScore(
        yieldSummary: StrategyResult["yieldSummary"],
        chainKey: ChainKey,
        network: Network,
        riskType: RiskType,
    ) {
        // since the APR is unbelievably high, we need to divide the score by the risk type
        const divisor = {
            [RiskType.LowRisk]: 1,
            [RiskType.MediumRisk]: 2,
            [RiskType.HighRisk]: 3,
            [RiskType.InsaneRisk]: 4,
        }
        if (!yieldSummary.aprs && !yieldSummary.apys) return 0

        const weights = {
            base: { weight: 0.5, divider: 1 },
            year: { weight: 0.25, divider: 365 },
            month: { weight: 0.15, divider: 30 },
            week: { weight: 0.075, divider: 7 },
            day: { weight: 0.025, divider: 1 },
        }

        let base = new Decimal(yieldSummary.aprs?.base ?? 0)
        let year = new Decimal(yieldSummary.aprs?.year ?? 0)
        let month = new Decimal(yieldSummary.aprs?.month ?? 0)
        let week = new Decimal(yieldSummary.aprs?.week ?? 0)

        const useApyOverApr = !!yieldSummary.apys
        if (useApyOverApr) {
            base = this.interestRateConverterService.toAPR(
                new Decimal(yieldSummary.apys?.base ?? 0),
                chainKey,
                network,
            )
            year = this.interestRateConverterService.toAPR(
                new Decimal(yieldSummary.apys?.year ?? 0),
                chainKey,
                network,
            )
            month = this.interestRateConverterService.toAPR(
                new Decimal(yieldSummary.apys?.month ?? 0),
                chainKey,
                network,
            )
            week = this.interestRateConverterService.toAPR(
                new Decimal(yieldSummary.apys?.week ?? 0),
                chainKey,
                network,
            )
        }

        const score = new Decimal(weights.base.weight)
            .times(base)
            .dividedBy(new Decimal(weights.base.divider))
            .plus(
                new Decimal(weights.year.weight)
                    .times(year)
                    .dividedBy(new Decimal(weights.year.divider)),
            )
            .plus(
                new Decimal(weights.month.weight)
                    .times(month)
                    .dividedBy(new Decimal(weights.month.divider)),
            )
            .plus(
                new Decimal(weights.week.weight)
                    .times(week)
                    .dividedBy(new Decimal(weights.week.divider)),
            )

        return score.mul(1000).dividedBy(divisor[riskType]).toNumber()
    }

    private calculateAnalysisFieldsScore(
        field: StrategyAnalysisField,
    ) {
        let score = 0
        // Confidence score multipe to 30 * (negative or positive)
        // If data want to negative and confident score is low, it do not affect much, so that the data is not reliable, and we can trust it can go in reverse
        // If data want to positive and confident score is low, it do not affect much, so that the data is not reliable
        // If data want to positive and confident score is high, it affect much, so that the data is reliable, many points
        // If data want to negative and confident score is high, it affect much, so that the data is reliable, negative points
        score += (field.confidenceScore ?? 0) * 30 * (field.growthYearly ?? 0 > 0 ? 1 : -1)
        // Field growthYearly is the growth of the field in the last year
        return score
    }

    private calculateGrowthScore(
        strategyAnalysis: StrategyResult["strategyAnalysis"],
        riskType: RiskType,
    ) {
        // in this strategy, the reliable always low, so we need to multipe score by the risk type
        const multiplier = {
            [RiskType.LowRisk]: 1,
            [RiskType.MediumRisk]: 2,
            [RiskType.HighRisk]: 3,
            [RiskType.InsaneRisk]: 4,
        }
        const weights = {
            // tvl often not the problems, low tvl = high yield
            tvlAnalysis: 0.05,
            // apy gain not problem, but the changes is much affeact
            apyAnalysis: 0.1,
            // same to apy
            aprAnalysis: 0.1,
            // people care on share price changes, since it mean the protocol work perfectly since user hold share token
            shareTokenPriceAnalysis: 0.5,
        }
        if (!strategyAnalysis) return 0
        let score = 0
        let strategiesWeight = 0    
        if (strategyAnalysis.tvlAnalysis) {
            score += this.calculateAnalysisFieldsScore(strategyAnalysis.tvlAnalysis) * weights.tvlAnalysis
            strategiesWeight += weights.tvlAnalysis
        }
        if (strategyAnalysis.apyAnalysis) {
            score += this.calculateAnalysisFieldsScore(strategyAnalysis.apyAnalysis) * weights.apyAnalysis
            strategiesWeight += weights.apyAnalysis
        }
        if (strategyAnalysis.aprAnalysis) {
            score += this.calculateAnalysisFieldsScore(strategyAnalysis.aprAnalysis) * weights.aprAnalysis
            strategiesWeight += weights.aprAnalysis
        }
        if (strategyAnalysis.shareTokenPriceAnalysis) {
            score += this.calculateAnalysisFieldsScore(strategyAnalysis.shareTokenPriceAnalysis) * weights.shareTokenPriceAnalysis
            strategiesWeight += weights.shareTokenPriceAnalysis
        }
        return score * multiplier[riskType] / strategiesWeight
    }

    private calculateAIInsightsScore(
        aiInsights: StrategyResult["strategyAIInsights"]
    ) {
        // ai will mark this from 0 to 10, so that we beleive in AI
        return aiInsights?.score ?? 0
    }
}   
