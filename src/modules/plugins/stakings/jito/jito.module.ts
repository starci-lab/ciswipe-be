import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./jito.module-definition"
import { JitoPluginService } from "./jito-plugin.service"
import { JitoSdkService } from "./jito-sdk.service"

@Module({
    providers: [
        JitoPluginService,
        JitoSdkService
    ],
    exports: [
        JitoPluginService,
    ],
})
export class JitoModule extends ConfigurableModuleClass {}