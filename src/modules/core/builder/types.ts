import { TokenData } from "@/modules/blockchain"

export enum RiskType {
    LowRisk = "low-risk",          // Safe
    MediumRisk = "medium-risk",    // Middle
    HighRisk = "high-risk",        // Risk
    InsaneRisk = "insane-risk",    // Ultra degen, >200% APR
}

export interface StrategyStep {
    apr?: number // total apr of the strategy
    apy?: number // total ary of the strategy
    transactionTxs: Array<string> // transaction of the strategy
    gasEstimated: number // gas estimate of the strategy
    inputTokens: Array<TokenData> // input tokens of the strategy
    id: string // unique id of the strategy
    outputTokens: Array<TokenData> // output tokens of the strategy
    nextChainId?: string // next chain id of the strategy
}

export interface StrategyAllocation {
    allocation: number // allocation of the strategy
    steps: Array<StrategyStep>
}

export interface BuildStrategyResult {
    id: string // unique id of the strategy
    totalApr?: number // total apr of the strategy
    totalAry?: number // total ary of the strategy
    allocations: Array<StrategyAllocation>
}