import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./probability-statistics.module-definition"
import { RegressionService } from "./regression.service"

@Module({
    providers: [RegressionService],
    exports: [RegressionService],
})
export class ProbabilityStatisticsModule extends ConfigurableModuleClass { }