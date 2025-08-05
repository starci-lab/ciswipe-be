import { GetStrategiesRequest, GetStrategiesResponse } from "./types"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { StrategiesService } from "./strategies.service"

@Resolver()
export class StrategiesResolver {
    constructor(
        private readonly strategiesService: StrategiesService,
    ) {}

    @Query(() => GetStrategiesResponse, {
        name: "getStrategies",
        description: "Get strategies",
    })
    async getStrategies(@Args("request") request: GetStrategiesRequest): Promise<GetStrategiesResponse> {
        return this.strategiesService.getStrategies(request)
    }
}