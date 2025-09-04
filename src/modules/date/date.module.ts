import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./date.module-definition"
import { DateService } from "./date.service"

@Module({
    providers: [DateService],
    exports: [DateService],
})
export class DateModule extends ConfigurableModuleClass { }
