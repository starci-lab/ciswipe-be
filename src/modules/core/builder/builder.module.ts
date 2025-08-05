import { Module } from "@nestjs/common"
import { LowRiskBuilderService } from "./low-risk-builder.service"
import { ConfigurableModuleClass } from "./builder.module-definition"

@Module({
    providers: [LowRiskBuilderService],
    exports: [LowRiskBuilderService],
})
export class BuilderModule extends ConfigurableModuleClass {}