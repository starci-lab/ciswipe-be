import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./ai.module-definition"
import { MetricAnalyzerService } from "./metric-analyzer.service"

@Module({
    providers: [MetricAnalyzerService],
    exports: [MetricAnalyzerService],
})
export class AIModule extends ConfigurableModuleClass { }
