import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lendings.module-definition"
import { KaminoModule } from "./kamino"

@Module({})
export class LendingsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            KaminoModule.register(options),
        ]
        return {
            ...dynamicModule,
            imports: modules,
            exports: modules,
        }
    }
}