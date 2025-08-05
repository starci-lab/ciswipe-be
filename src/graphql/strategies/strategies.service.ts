import { Injectable } from "@nestjs/common"
import { LowRiskBuilderService } from "@/modules/core/builder/low-risk-builder.service"
import { GetStrategiesRequest, GetStrategiesResponse } from "./types"

@Injectable()
export class StrategiesService {
    constructor(private readonly lowRiskBuilderService: LowRiskBuilderService) {}

    public async getStrategies({
        chainKeys,
        network,
        riskTypes,
    }: GetStrategiesRequest): Promise<GetStrategiesResponse> {
        const strategies =
      await this.lowRiskBuilderService.buildSimpleVaultStrategies({
          chainKeys,
          riskTypes,
          network,
      })
        return {
            strategies,
        }
    }
}
