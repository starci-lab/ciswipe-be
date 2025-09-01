import { Module } from "@nestjs/common"
import { LockService } from "./lock.service"
import { ConfigurableModuleClass } from "./misc.module-definition"
import { RetryService } from "./retry.service"
import { NextJsQueryService } from "./nextjs-query.serivce"
import { DayjsService } from "./dayjs.service"

@Module({
    providers: [LockService, RetryService, NextJsQueryService, DayjsService],
    exports: [LockService, RetryService, NextJsQueryService, DayjsService],
})
export class MiscModule extends ConfigurableModuleClass {}