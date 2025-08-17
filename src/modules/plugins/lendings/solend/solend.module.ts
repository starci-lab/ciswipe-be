import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./solend.module-definition"
import { SolendLendingFetchService } from "./solend-fetch.service"
import { SolendLendingApiService } from "./solend-api.service"
import { SolendLendingRpcService } from "./solend-rpc.service"
import { SolendLendingIndexerService } from "./solend-indexer.service"
import { SolendLendingInitService } from "./solend-init.service"
import { SolendLendingPluginService } from "./solend-plugin.service"
import { SolendLendingLevelService } from "./solend-level.service"
import { SolendLendingCacheService } from "./solend-cache.service"

@Module({
    providers: [
        SolendLendingFetchService, 
        SolendLendingApiService, 
        SolendLendingRpcService,
        SolendLendingIndexerService,
        SolendLendingInitService,
        SolendLendingPluginService,
        SolendLendingLevelService,
        SolendLendingCacheService,
    ],
    exports: [SolendLendingPluginService],
})
export class SolendLendingModule extends ConfigurableModuleClass {}