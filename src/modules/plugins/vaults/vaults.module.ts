import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./vaults.module-definition"
//import { KaminoModule } from "./kamino"
import { VaultStorageService } from "./vault-storage.service"
import { KaminoVaultModule } from "./kamino"

@Module({})
export class VaultsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            KaminoVaultModule.register(options),
        ]
        return {
            ...dynamicModule,
            imports: modules,
            providers: [
                ...(dynamicModule.providers || []),
                VaultStorageService
            ],
            exports: [
                ...modules,
                VaultStorageService
            ],
        }
    }
}