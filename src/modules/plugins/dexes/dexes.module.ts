import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dexes.module-definition"
import { RaydiumModule } from "./raydium"
//import { CetusModule } from "./cetus"

@Module({})
export class DexesModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            RaydiumModule.register(options),
            //CetusModule.register(options),
        ]
        return {
            ...dynamicModule,
            imports: modules,
            exports: modules,
        }
    }
}