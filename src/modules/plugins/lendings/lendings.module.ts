import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lendings.module-definition"
//import { KaminoModule } from "./kamino"
import { LendingStorageService } from "./lending-storage.service"
import { SolendModule } from "./solend"

@Module({})
export class LendingsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            // kamino lending is deprecated, will enter vaults service instead
            //KaminoModule.register(options),
            SolendModule.register(options),
        ]
        return {
            ...dynamicModule,
            imports: modules,
            providers: [
                ...(dynamicModule.providers || []),
                LendingStorageService
            ],
            exports: [
                ...modules,
                LendingStorageService
            ],
        }
    }
}