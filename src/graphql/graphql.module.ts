import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./graphql.module-definition"
import { StrategiesModule } from "./strategies"

@Module({})
export class GraphQLModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const strategiesModule = StrategiesModule.register({
            isGlobal: options.isGlobal
        })
        return {
            ...dynamicModule,
            imports: [
                strategiesModule,
            ],
        }
    }
}