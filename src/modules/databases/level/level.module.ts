import { DynamicModule, Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./level.module-definition"
import { getLevelProvider } from "./level.providers"
import { LevelHelpersService } from "./level-helpers.provider"
import { LevelSubscriptionService } from "./level-subscription.service"

@Module({})
export class LevelModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const levelProvider = getLevelProvider()

        return {
            ...dynamicModule,
            providers: [
                levelProvider,
                LevelHelpersService,
                LevelSubscriptionService,
            ],
            exports: [
                levelProvider,
                LevelHelpersService,
            ]
        }
    }
}