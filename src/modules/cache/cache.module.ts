
import { DynamicModule, Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./cache.module-definition"
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager" 
import { createKeyv, Keyv } from "@keyv/redis"
import { CacheableMemory } from "cacheable"
import { envConfig } from "@/modules/env"

@Module({})
export class CacheModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
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
            ...dynamicModule,
            imports: [nestCacheModule],
            exports: [nestCacheModule]
        }
    }
}
