import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./solend.module-definition"
import { SolendLendingFetchService } from "./solend-fetch.service"
import { SolendLendingApiService } from "./solend-api.service"

@Module({
    providers: [SolendLendingFetchService, SolendLendingApiService],
    exports: [],
})
export class SolendModule extends ConfigurableModuleClass {}