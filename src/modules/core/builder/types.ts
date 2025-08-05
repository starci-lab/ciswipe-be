import { ChainKey, Network } from "@/modules/common"
import { createEnumType } from "@/modules/common"
import { Field, Float, ObjectType, registerEnumType } from "@nestjs/graphql"
import { TokenData } from "@/modules/blockchain"

export enum RiskType {
    LowRisk = "lowRisk",          // Safe
    MediumRisk = "mediumRisk",    // Middle
    HighRisk = "highRisk",        // Risk
    InsaneRisk = "insaneRisk",    // Ultra degen, >200% APR
}

export const GraphQLTypeRiskType = createEnumType(RiskType) 

registerEnumType(GraphQLTypeRiskType, {
    name: "RiskType",
    description: "The risk type",
    valuesMap: {
        [RiskType.LowRisk]: { description: "Low risk" },
        [RiskType.MediumRisk]: { description: "Medium risk" },
        [RiskType.HighRisk]: { description: "High risk" },
        [RiskType.InsaneRisk]: { description: "Insane risk (Ultra degen, >200% APR)" },
    },
})

@ObjectType()
export class StrategyStep {
    @Field(() => Float, { nullable: true, description: "Total apr of the strategy" })
        apr?: number // total apr of the strategy
    @Field(() => Float, { nullable: true, description: "Total ary of the strategy" })
        apy?: number // total ary of the strategy
    @Field(() => [String])
        transactionTxs: Array<string> // transaction of the strategy
    @Field(() => Float, { description: "Gas estimate of the strategy" })
        gasEstimated: number // gas estimate of the strategy
    @Field(() => [TokenData], { description: "Input tokens of the strategy" })
        inputTokens: Array<TokenData> // input tokens of the strategy
    @Field(() => String)
        id: string // unique id of the strategy
    @Field(() => [TokenData], { description: "Output tokens of the strategy" })
        outputTokens: Array<TokenData> // output tokens of the strategy
    @Field(() => String, { nullable: true })
        nextChainId?: string // next chain id of the strategy
}

@ObjectType()
export class StrategyAllocation {
    @Field(() => Float, { description: "Allocation of the strategy" })
        allocation: number // allocation of the strategy
    @Field(() => [StrategyStep], { description: "Steps of the strategy" })
        steps: Array<StrategyStep>
}

@ObjectType()
export class BuildStrategyResult {
    @Field(() => String, { description: "Unique id of the strategy" })
        id: string // unique id of the strategy
    @Field(() => Float, { nullable: true, description: "Total apr of the strategy" })
        totalApr?: number // total apr of the strategy
    @Field(() => Float, { nullable: true, description: "Total ary of the strategy" })
        totalAry?: number // total ary of the strategy
    @Field(() => [StrategyAllocation], { description: "Allocations of the strategy" })
        allocations: Array<StrategyAllocation>
}

export interface StrategyQuoteRequest {
    chainKeys: Array<ChainKey>
    riskTypes: Array<RiskType>
    network?: Network // default: mainnet
}