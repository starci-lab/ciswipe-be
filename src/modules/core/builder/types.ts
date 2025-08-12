import { ChainKey, Network, StrategyResult } from "@/modules/common"
import { Field, Float, ObjectType } from "@nestjs/graphql"
import { RiskType } from "../types"


@ObjectType({
    description: "Step "
})
export class Step {
    @Field(() => StrategyResult, { description: "Step result" })
        strategy: StrategyResult // result of the step
    @Field(() => Float, { description: "Score of the step" })
        score: number // score of the step  
}

@ObjectType({
    description: "Strategy allocation",
})
export class StrategyAllocation {
    @Field(() => Float, { description: "Allocation of the strategy" })
        allocation: number // allocation of the strategy
    @Field(() => [Step], { description: "Steps of the strategy" })
        steps: Array<Step>
}

@ObjectType({
    description: "Build strategy result",
})
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
