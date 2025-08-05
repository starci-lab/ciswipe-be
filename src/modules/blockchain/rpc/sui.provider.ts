import { Provider } from "@nestjs/common"
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client"
import { createProviderToken, RecordRpcProvider } from "./types"
import { ChainKey, Network } from "@/modules/common"

export interface SuiProvider {
    client: SuiClient
    url: string
}
export const getSuiRpcsProvider = (): Provider<RecordRpcProvider<SuiProvider>> => ({
    provide: createProviderToken(ChainKey.Sui),
    useFactory: (): RecordRpcProvider<SuiProvider> => {
        const mainnetUrl = getFullnodeUrl("mainnet")
        const testnetUrl = getFullnodeUrl("testnet")
        return {
            [Network.Mainnet]: {
                client: new SuiClient({
                    url: mainnetUrl,
                }),
                url: mainnetUrl,
            },
            [Network.Testnet]: {
                client: new SuiClient({
                    url: testnetUrl,
                }),
                url: testnetUrl,
            },
        }
    },
})