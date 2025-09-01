import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./databases.module-definition"
import { LevelModule } from "./level"
import { MongooseModule } from "./mongoose"

@Module({})
export class DatabasesModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const levelModule = LevelModule.register({
            isGlobal: options.isGlobal,
        })
        const mongooseModule = MongooseModule.forRoot({
            isGlobal: options.isGlobal,
        })
        return {
            ...dynamicModule,
            imports: [
                levelModule,
                mongooseModule,
            ],
            exports: [
                levelModule
            ],
        }
    }
}