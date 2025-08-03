import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./stakings.module-definition"
import { JitoModule } from "./jito"

@Module({})
export class StakingsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            JitoModule.register(options),
        ]
        return {
            ...dynamicModule,
            imports: modules,
            exports: modules,
        }
    }
}