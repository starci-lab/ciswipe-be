import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./raydium.module-definition"
import { RaydiumPluginService } from "./raydium-plugin.service"
import { RaydiumFetchService } from "./raydium-fetch.service"
import { RaydiumIndexerService } from "./raydium-indexer.service"
import { RaydiumInitService } from "./raydium-init.service"
import { RaydiumApiService } from "./raydium-api.service"
import { RaydiumLevelService } from "./raydium-level.service"
import { RaydiumCacheService } from "./raydium-cache.service"

@Module({
    providers: [
        RaydiumPluginService,
        RaydiumFetchService,
        RaydiumIndexerService,
        RaydiumInitService,
        RaydiumApiService,
        RaydiumLevelService,
        RaydiumCacheService,
    ],
    exports: [
        RaydiumPluginService,
    ],
})
export class RaydiumModule extends ConfigurableModuleClass {}