import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./plugins.module-definition"
import { DexesModule } from "./dexes"
import { AggregatorsModule } from "./aggregators"
import { StakingsModule } from "./stakings"
import { LendingsModule } from "./lendings"
import { VaultsModule } from "./vaults"

@Module({})
export class PluginsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const dexesModule = DexesModule.register({
            isGlobal: options.isGlobal,
        })
        const aggregatorsModule = AggregatorsModule.register({
            isGlobal: options.isGlobal,
        })
        const stakingsModule = StakingsModule.register({
            isGlobal: options.isGlobal,
        })
        const lendingsModule = LendingsModule.register({
            isGlobal: options.isGlobal,
        })
        const vaultsModule = VaultsModule.register({
            isGlobal: options.isGlobal,
        })
        return {
            ...dynamicModule,
            imports: [
                dexesModule,
                aggregatorsModule,
                stakingsModule,
                lendingsModule,
                vaultsModule
            ],
            exports: [
                // dexesModule,
                // aggregatorsModule,
                // stakingsModule,
                // lendingsModule
                vaultsModule
            ],
        }
    }
}