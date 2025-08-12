import {
    ChainKey,
    GraphQLTypeChainKey,
    GraphQLTypeNetwork,
    Network,
} from "@/modules/common"
import { BuildStrategyResult } from "@/modules/core"
import { GraphQLTypeRiskType, RiskType } from "@/modules/core/types"
import { Field, InputType, ObjectType } from "@nestjs/graphql"

@InputType()
export class GetStrategiesRequest {
  @Field(() => [GraphQLTypeChainKey], {
      defaultValue: [
          ChainKey.Solana,
          ChainKey.Sui
      ]
  })
      chainKeys: Array<ChainKey>
  @Field(() => [GraphQLTypeRiskType], {
      defaultValue: [
          RiskType.LowRisk,
          RiskType.MediumRisk
      ]
  })
      riskTypes: Array<RiskType>
  @Field(() => GraphQLTypeNetwork, {
      defaultValue: Network.Mainnet,
  })
      network: Network
}

@ObjectType()
export class GetStrategiesResponse {
    @Field(() => [BuildStrategyResult])
        strategies: Array<BuildStrategyResult>
}