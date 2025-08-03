import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./cetus.module-definition"
import { CetusPlugin } from "./cetus.plugin"
import { CetusSdk } from "./cetus.sdk"

@Module({
    providers: [
        CetusPlugin,
        CetusSdk,
    ],
    exports: [
        CetusPlugin,
    ],
})
export class CetusModule extends ConfigurableModuleClass {}