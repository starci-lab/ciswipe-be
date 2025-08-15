import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./raydium.module-definition"
import { RaydiumPluginService } from "./raydium-plugin.service"
import { RaydiumFetchService } from "./raydium-fetch.service"
import { RaydiumIndexerService } from "./raydium-indexer.service"
import { RaydiumInitService } from "./raydium-init.service"
import { RaydiumApiService } from "./raydium-api.service"

@Module({
    providers: [
        RaydiumPluginService,
        RaydiumFetchService,
        RaydiumIndexerService,
        RaydiumInitService,
        RaydiumApiService,
    ],
    exports: [
        RaydiumPluginService,
    ],
})
export class RaydiumModule extends ConfigurableModuleClass {}