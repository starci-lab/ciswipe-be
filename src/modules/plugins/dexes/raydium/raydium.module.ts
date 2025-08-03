import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./raydium.module-definition"
import { RaydiumPlugin } from "./raydium.plugin"

@Module({
    providers: [
        RaydiumPlugin,
    ],
    exports: [
        RaydiumPlugin,
    ],
})
export class RaydiumModule extends ConfigurableModuleClass {}