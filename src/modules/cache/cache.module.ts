
import { DynamicModule, Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./cache.module-definition"
import {
    createRedisCacheManagerFactoryProvider, 
    createMemoryCacheManagerFactoryProvider 
} from "./cache.providers"
import { CacheHelpersService } from "./cache-helpers.service"

@Module({})
export class CacheModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const providers = [
            createRedisCacheManagerFactoryProvider(),
            createMemoryCacheManagerFactoryProvider(),
            CacheHelpersService
        ]
        return {
            ...dynamicModule,
            providers,
            exports: [...providers],
        }
    }
}
