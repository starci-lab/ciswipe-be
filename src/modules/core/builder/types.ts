import { ChainKey, Network, StrategyResult } from "@/modules/common"
import { createEnumType } from "@/modules/common"
import { Field, Float, ObjectType, registerEnumType } from "@nestjs/graphql"

export enum RiskType {
  LowRisk = "lowRisk", // Safe
  MediumRisk = "mediumRisk", // Middle
  HighRisk = "highRisk", // Risk
  InsaneRisk = "insaneRisk", // Ultra degen, >200% APR
}

export const GraphQLTypeRiskType = createEnumType(RiskType)

registerEnumType(GraphQLTypeRiskType, {
    name: "RiskType",
    description: "The risk type",
    valuesMap: {
        [RiskType.LowRisk]: { description: "Low risk" },
        [RiskType.MediumRisk]: { description: "Medium risk" },
        [RiskType.HighRisk]: { description: "High risk" },
        [RiskType.InsaneRisk]: {
            description: "Insane risk (Ultra degen, >200% APR)",
        },
    },
})


@ObjectType()
export class StrategyAllocation {
  @Field(() => Float, { description: "Allocation of the strategy" })
      allocation: number // allocation of the strategy
  @Field(() => [StrategyResult], { description: "Steps of the strategy" })
      steps: Array<StrategyResult>
}

@ObjectType()
export class BuildStrategyResult {
  @Field(() => String, { description: "Unique id of the strategy" })
      id: string // unique id of the strategy
  @Field(() => [StrategyAllocation], {
      description: "Allocations of the strategy",
  })
      allocations: Array<StrategyAllocation>
}

export interface StrategyQuoteRequest {
  chainKeys: Array<ChainKey>;
  riskTypes: Array<RiskType>;
  network?: Network; // default: mainnet
}
