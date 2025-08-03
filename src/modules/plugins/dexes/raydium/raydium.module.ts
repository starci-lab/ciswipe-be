import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./raydium.module-definition"
import { RaydiumPluginService } from "./raydium-plugin.service"

@Module({
    providers: [
        RaydiumPluginService,
    ],
    exports: [
        RaydiumPluginService,
    ],
})
export class RaydiumModule extends ConfigurableModuleClass {}