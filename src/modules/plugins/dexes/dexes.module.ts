import { DynamicModule, Module, Provider } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dexes.module-definition"
import { RaydiumPlugin } from "./raydium"

@Module({})
export class DexesModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const plugins: Array<Provider> = [
            RaydiumPlugin
        ]
        return {
            ...dynamicModule,
            providers: [
                ...(dynamicModule.providers ?? []),
                ...plugins,
            ],
            exports: [
                ...plugins,
            ],
        }
    }
}