import { Module } from "@nestjs/common"
import { LockService } from "./lock.service"
import { ConfigurableModuleClass } from "./misc.module-definition"
import { RetryService } from "./retry.service"

@Module({
    providers: [LockService, RetryService],
    exports: [LockService, RetryService],
})
export class MiscModule extends ConfigurableModuleClass {}