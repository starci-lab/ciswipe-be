import { Provider } from "@nestjs/common"
import { ethers } from "ethers"
import { createProviderToken, RecordRpcProvider } from "./types"
import { ChainKey, chainKeyToPlatform, Network, Platform } from "@/modules/common"

export interface EthereumRpcMetadata {
    rpcUrl: string
    chainId: number
}

const getMetadata = (chainKey: ChainKey, network: Network): EthereumRpcMetadata => {
    if (chainKeyToPlatform(chainKey) !== Platform.Evm) {
        throw new Error("Chain key is not an Ethereum chain")
    }
    switch (chainKey) {
    case ChainKey.Monad:
        return {
            rpcUrl: `https://eth-${network}.g.alchemy.com/v2/your-api-key`,
            chainId: 1,
        }
    case ChainKey.Bsc:
        return {
            rpcUrl: `https://bsc-${network}.g.alchemy.com/v2/your-api-key`,
            chainId: 56,
        }
    }
    throw new Error("Chain key is not an Ethereum chain")
}

export const getEvmRpcsProvider: (
  chainKey: ChainKey,
) => Provider<RecordRpcProvider<ethers.JsonRpcProvider>> = (chainKey) => ({
    provide: createProviderToken(chainKey),
    useFactory: (): RecordRpcProvider<ethers.JsonRpcProvider> => {
        const metadata = getMetadata(chainKey, Network.Mainnet)
        const metadataTestnet = getMetadata(chainKey, Network.Testnet)
        return {
            [Network.Mainnet]: new ethers.JsonRpcProvider(
                metadata.rpcUrl,
                metadata.chainId, // Chain ID for Ethereum Mainnet
            ),
            [Network.Testnet]: new ethers.JsonRpcProvider(
                metadataTestnet.rpcUrl,
                metadataTestnet.chainId, // Chain ID for Sepolia
            ),
        }
    },
})
