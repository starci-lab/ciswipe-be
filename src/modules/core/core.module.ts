import { DynamicModule, Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./core.module-definition"
import { BuilderModule } from "./builder"
import { ScoringModule } from "./scoring"

@Module({})
export class CoreModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
        const dynamicModule = super.register(options)
        const builderModule = BuilderModule.register({
            isGlobal: options.isGlobal,
        })
        const scoringModule = ScoringModule.register({
            isGlobal: options.isGlobal,
        })
        return {
            ...dynamicModule,
            imports: [...(dynamicModule.imports || []), builderModule, scoringModule],
            exports: [...(dynamicModule.exports || []), builderModule, scoringModule],
        }
    }
}
