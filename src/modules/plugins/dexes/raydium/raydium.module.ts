import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./raydium.module-definition"
import { RaydiumDexPluginService } from "./raydium-plugin.service"
import { RaydiumDexFetchService } from "./raydium-fetch.service"
import { RaydiumDexIndexerService } from "./raydium-indexer.service"
import { RaydiumDexInitService } from "./raydium-init.service"
import { RaydiumDexApiService } from "./raydium-api.service"
import { RaydiumDexDataService } from "./raydium-data.service"
import { RaydiumDexCacheService } from "./raydium-cache.service"

@Module({
    providers: [
        RaydiumDexPluginService,
        RaydiumDexFetchService,
        RaydiumDexIndexerService,
        RaydiumDexInitService,
        RaydiumDexApiService,
        RaydiumDexDataService,
        RaydiumDexCacheService,
    ],
    exports: [
        RaydiumDexPluginService,
    ],
})
export class RaydiumDexModule extends ConfigurableModuleClass {}