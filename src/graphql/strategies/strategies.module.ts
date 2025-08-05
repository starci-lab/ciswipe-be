import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./strategies.module-definition"
import { StrategiesService } from "./strategies.service"
import { StrategiesResolver } from "./strategies.resolver"

@Module({
    providers: [
        StrategiesService,
        StrategiesResolver,
    ]
})
export class StrategiesModule extends ConfigurableModuleClass {}