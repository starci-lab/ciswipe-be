import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lendings.module-definition"
import { LendingStorageService } from "./lending-storage.service"
import { SolendLendingModule } from "./solend"

@Module({})
export class LendingsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            SolendLendingModule.register(options),
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