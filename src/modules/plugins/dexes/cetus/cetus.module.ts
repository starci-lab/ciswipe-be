import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./cetus.module-definition"
import { CetusPluginService } from "./cetus-plugin.service"
import { CetusSdkService } from "./cetus-sdk.service"

@Module({
    providers: [
        CetusPluginService,
        CetusSdkService,
    ],
    exports: [
        CetusPluginService,
    ],
})
export class CetusModule extends ConfigurableModuleClass {}