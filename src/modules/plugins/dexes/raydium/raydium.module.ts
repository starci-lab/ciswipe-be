import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./raydium.module-definition"
import { RaydiumDexPluginService } from "./raydium-plugin.service"
import { RaydiumDexFetchService } from "./raydium-fetch.service"
import { RaydiumDexIndexerService } from "./raydium-indexer.service"
import { RaydiumDexInitService } from "./raydium-init.service"
import { RaydiumDexApiService } from "./raydium-api.service"
import { RaydiumDexLevelService } from "./raydium-level.service"
import { RaydiumDexCacheService } from "./raydium-cache.service"

@Module({
    providers: [
        RaydiumDexPluginService,
        RaydiumDexFetchService,
        RaydiumDexIndexerService,
        RaydiumDexInitService,
        RaydiumDexApiService,
        RaydiumDexLevelService,
        RaydiumDexCacheService,
    ],
    exports: [
        RaydiumDexPluginService,
    ],
})
export class RaydiumDexModule extends ConfigurableModuleClass {}