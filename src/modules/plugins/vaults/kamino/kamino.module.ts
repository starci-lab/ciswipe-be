import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./kamino.module-definition"
import { KaminoVaultPluginService } from "./kamino-plugin.service"
import { KaminoVaultApiService } from "./kamino-api.service"
import { KaminoVaultFetchService } from "./kamino-fetch.service"
import { KaminoVaultIndexerService } from "./kamino-indexer.service"
import { KaminoVaultInitService } from "./kamino-init.service"

@Module({
    providers: [
        KaminoVaultPluginService, 
        KaminoVaultApiService, 
        KaminoVaultFetchService,
        KaminoVaultIndexerService,
        KaminoVaultInitService
    ],
    exports: [KaminoVaultPluginService],
})
export class KaminoVaultModule extends ConfigurableModuleClass {}