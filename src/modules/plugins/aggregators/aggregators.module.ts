import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./aggregators.module-definition"
import { JupiterModule } from "./jupiter"

@Module({})
export class AggregatorsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            JupiterModule.register(options),
        ]
        return {
            ...dynamicModule,
            imports: modules,
            exports: modules,
        }
    }
}