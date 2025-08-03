import { DynamicModule, Module, Provider } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./rpc.module-definition"
import { getSolanaRpcsProvider } from "./solana.providers"
import { getEvmRpcsProvider } from "./evm.provider"
import { ChainKey, chainKeyToPlatform, Platform } from "../types"
import { getSuiRpcsProvider } from "./sui.provider"

@Module({})
export class RpcModule extends ConfigurableModuleClass {
    static register(
        options: typeof OPTIONS_TYPE = {}
    ): DynamicModule {
        const dynamicModule = super.register(options)
        const solanaRpcsProvider = getSolanaRpcsProvider()
        const evmProviders: Array<Provider> = []
        for (const chainKey of Object.values(ChainKey)) {
            if (chainKeyToPlatform(chainKey) === Platform.Evm) {
                evmProviders.push(getEvmRpcsProvider(chainKey))
            }
        }
        const suiRpcsProvider = getSuiRpcsProvider()
        return {
            ...dynamicModule,
            providers: [
                solanaRpcsProvider,
                ...evmProviders,
                suiRpcsProvider,
            ],
            exports: [
                solanaRpcsProvider,
                ...evmProviders,
                suiRpcsProvider,
            ]
        }
    }
}