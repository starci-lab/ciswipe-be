import { Module } from "@nestjs/common"
import { ScoringService } from "./scoring.service"
import { ConfigurableModuleClass } from "./scoring.module-definition"

@Module({
    providers: [ScoringService],
    exports: [ScoringService],
})
export class ScoringModule extends ConfigurableModuleClass {}