import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./kamino.module-definition"
import { KaminoPluginService } from "./kamino-plugin.service"

@Module({
    providers: [KaminoPluginService],
    exports: [KaminoPluginService],
})
export class KaminoModule extends ConfigurableModuleClass {}