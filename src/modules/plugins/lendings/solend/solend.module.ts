import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./solend.module-definition"
import { SolendLendingFetchService } from "./solend-fetch.service"
import { SolendLendingApiService } from "./solend-api.service"
import { SolendRpcService } from "./solend-rpc.service"
import { SolendLendingIndexerService } from "./solend-indexer.service"
import { SolendLendingInitService } from "./solend-init.service"

@Module({
    providers: [
        SolendLendingFetchService, 
        SolendLendingApiService, 
        SolendRpcService,
        SolendLendingIndexerService,
        SolendLendingInitService
    ],
    exports: [],
})
export class SolendLendingModule extends ConfigurableModuleClass {}