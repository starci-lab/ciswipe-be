
import { DynamicModule, Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./cache.module-definition"
import {
    createRedisCacheManagerProvider, 
    createMemoryCacheManagerProvider 
} from "./cache.providers"
import { CacheHelpersService } from "./cache-helpers.service"
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager"
import Keyv from "keyv"
import { CacheableMemory } from "cacheable"
import { createKeyv } from "@keyv/redis"
import { envConfig } from "../env"

@Module({})
export class CacheModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const providers = [
            createRedisCacheManagerProvider(),
            createMemoryCacheManagerProvider(),
            CacheHelpersService
        ]
        const nestCacheModule = NestCacheModule.registerAsync({
            useFactory: async () => {
                return {
                    stores: [
                        new Keyv({
                            store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
                        }),
                        createKeyv({
                            password: envConfig().redis.password,
                            url: `redis://${envConfig().redis.host}:${envConfig().redis.port}`,
                        }),
                    ],
                    ttl: envConfig().redis.ttl,
                }
            },
        })
        return {
            imports: [nestCacheModule],
            ...dynamicModule,
            providers,
            exports: [...providers, nestCacheModule],
        }
    }
}
