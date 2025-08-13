import { DynamicModule, Module } from "@nestjs/common"
import { RpcModule } from "./rpc"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./blockchain.module-definition"
import { BlockModule } from "./block"

@Module({})
export class BlockchainModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const rpcModule = RpcModule.register({
            isGlobal: options.isGlobal,
        }) 
        const blockModule = BlockModule.register({
            isGlobal: options.isGlobal,
        })
        return {
            ...dynamicModule,
            imports: [
                rpcModule,
                blockModule
            ],
            exports: [
                rpcModule,
                blockModule
            ],
        }
    }
}