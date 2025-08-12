import { registerEnumType } from "@nestjs/graphql"
import { createEnumType } from "../common"

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
