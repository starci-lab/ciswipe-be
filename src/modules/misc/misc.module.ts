import { Module } from "@nestjs/common"
import { LockService } from "./lock.service"
import { ConfigurableModuleClass } from "./misc.module-definition"

@Module({
    providers: [LockService],
    exports: [LockService],
})
export class MiscModule extends ConfigurableModuleClass {}