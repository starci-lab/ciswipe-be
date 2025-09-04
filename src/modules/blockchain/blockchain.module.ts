import { DynamicModule, Module } from "@nestjs/common"
import { RpcModule } from "./rpc"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./blockchain.module-definition"
import { BlockModule } from "./block"
import { TokensModule } from "./tokens"
import { KeypairsModule } from "./keypairs"

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
        const tokensModule = TokensModule.register({
            isGlobal: options.isGlobal,
        })
        const keypairsModule = KeypairsModule.register({
            isGlobal: options.isGlobal,
        })
        return {
            ...dynamicModule,
            imports: [
                rpcModule,
                blockModule,
                tokensModule,
                keypairsModule
            ],
            exports: [
                rpcModule,
                blockModule,
                tokensModule,
                keypairsModule
            ],
        }
    }
}