import { Field, Float, Int, ObjectType } from "@nestjs/graphql"
import GraphQLJSON from "graphql-type-json"
import { Atomic } from "./atomic"
import { GraphQLTypeTokenType, TokenType } from "./blockchain"

@ObjectType({
    description: "Yield of the strategy in 24h, 7d, 30d, 365d",
})
export class YieldPeriodMetric {
    @Field(() => Float, {
        nullable: true,
        description: "Base yield of the strategy",
    })
        base?: number
    @Field(() => Float, {
        nullable: true,
        description: "Yield of the strategy in 24h",
    })
        day?: number

    @Field(() => Float, {
        nullable: true,
        description: "Yield of the strategy in 7d",
    })
        week?: number

    @Field(() => Float, {
        nullable: true,
        description: "Yield of the strategy in 30d",
    })
        month?: number

    @Field(() => Float, {
        nullable: true,
        description: "Yield of the strategy in 365d",
    })
        year?: number
}

@ObjectType({
    description: "Yield summary of the strategy",
})
export class YieldSummary {
    @Field(() => YieldPeriodMetric, {
        nullable: true,
        description: "Yield of the strategy in 24h, 7d, 30d, 365d",
    })
        aprs?: YieldPeriodMetric
    @Field(() => YieldPeriodMetric, {
        nullable: true,
        description: "Yield of the strategy in 24h, 7d, 30d, 365d",
    })
        apys?: YieldPeriodMetric
}

@ObjectType({
    description: "Output token of the strategy",
})
export class OutputToken {
    @Field(() => String, {
        description: "Token id, use string-friendly format, if not found, we return a generated UUID instead",
    })
        id: string

    @Field(() => String, {
        description: "Token name",
        nullable: true,
    })
        name?: string

    @Field(() => String, {
        description: "Token symbol",
        nullable: true,
    })
        symbol?: string

    @Field(() => String, {
        description: "Token address",
        nullable: true,
    })
        address?: string

    @Field(() => String, {
        description: "Icon URL",
        nullable: true,
    })
        icon?: string

    @Field(() => GraphQLTypeTokenType, {
        description: "Token type",
        nullable: true,
    })
        type?: TokenType

    @Field(() => Int, {
        description: "Token decimals",
        nullable: true,
    })
        decimals?: number

    @Field(() => Float, {
        description: "Token price in USD",
        nullable: true,
    })
        priceInUSD?: number
}

@ObjectType({
    description: "Output tokens of the strategy",
})
export class OutputTokens {
    @Field(() => [OutputToken], {
        description: "Output tokens",
    })
        tokens: Array<OutputToken>
}

@ObjectType({
    description: "AI analysis of the strategy",
})
export class AIAnalysis {
    @Field(() => Float, {
        description: "Confident score calculated by AI, typically a numeric value from 0 to 100",
    })
        confidenceScore: number

    @Field(() => Float, {
        description: "Safety score of the strategy, higher means safer, typically a numeric value from 0 to 100",
    })
        safeScore: number

    @Field(() => String, {
        description: "Statistical analysis of the strategy",
    })
        statisticalAnalysis: string

    @Field(() => String, {
        description: "Insights of the strategy",
        nullable: true,
    })
        insights?: string
}

@ObjectType({
    description: "Result of the strategy",
})
export class StrategyResult {
    @Field(() => String, {
        description: "Strategy id",
    })
        id: string
    @Field(() => OutputTokens, {
        description: "Output tokens of the strategy",
    })
        outputTokens: OutputTokens
    @Field(() => YieldSummary, {
        description: "Yield summary of the strategy",
    })
        yieldSummary: YieldSummary

    @Field(() => AIAnalysis, {
        description: "AI analysis of the strategy",
    })
        aiAnalysis: AIAnalysis

    @Field(() => GraphQLJSON, {
        description: "Metadata of the strategy",
    })
        metadata: Record<string, Atomic>
}