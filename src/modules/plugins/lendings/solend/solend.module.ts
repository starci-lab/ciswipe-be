import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./solend.module-definition"
import { SolendLendingFetchService } from "./solend-fetch.service"
import { SolendLendingApiService } from "./solend-api.service"
import { SolendRpcService } from "./solend-rpc.service"

@Module({
    providers: [SolendLendingFetchService, SolendLendingApiService, SolendRpcService],
    exports: [],
})
export class SolendLendingModule extends ConfigurableModuleClass {}