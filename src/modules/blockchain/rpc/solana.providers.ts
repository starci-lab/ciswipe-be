import { Provider } from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { createProviderToken, RecordRpcProvider } from "./types"
import { ChainKey, Network } from "../types"

export const getSolanaRpcsProvider = (): Provider<RecordRpcProvider<Connection>> => ({
    provide: createProviderToken(ChainKey.Solana),
    useFactory: (): RecordRpcProvider<Connection> => {
        return {
            [Network.Mainnet]: new Connection(
                "https://mainnet.helius-rpc.com/?api-key=195f7f46-73d5-46df-989e-9d743bf3caad",
                "confirmed",
            ),
            [Network.Testnet]: new Connection(
                "https://api.devnet.solana.com",
                "confirmed",
            ),
        }
    }
})