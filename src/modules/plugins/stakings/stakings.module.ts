import { DynamicModule, Module } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./stakings.module-definition"
//import { JitoModule } from "./jito"
import { StakingStorageService } from "./staking-storage.service"

@Module({})
export class StakingsModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const modules: Array<DynamicModule> = [
            //JitoModule.register(options),
        ]
        return {
            ...dynamicModule,
            providers: [
                ...(dynamicModule.providers || []),
                StakingStorageService
            ],
            imports: modules,
            exports: [
                ...modules,
                StakingStorageService
            ],
        }
    }
}