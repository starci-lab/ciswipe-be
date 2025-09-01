import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./jito.module-definition"
// import { JitoPluginService } from "./jito-plugin.service"
import { JitoStakingApiService } from "./jito-api.service"
@Module({
    providers: [
        // JitoPluginService,
        // JitoSdkService
        JitoStakingApiService
    ],
    exports: [
        // JitoPluginService,
        JitoStakingApiService
    ],
})
export class JitoModule extends ConfigurableModuleClass {}