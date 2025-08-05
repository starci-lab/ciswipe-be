import { registerEnumType } from "@nestjs/graphql"
import { createEnumType } from "../utils"

export enum ChainKey {
  // Solana
  Solana = "solana",
  // Monad
  Monad = "monad",
  // BSC
  Bsc = "bsc",
  // Sui
  Sui = "sui",
}

export const GraphQLTypeChainKey = createEnumType(ChainKey)

registerEnumType(GraphQLTypeChainKey, {
    name: "ChainKey",
    description: "The chain key",
    valuesMap: {
        [ChainKey.Solana]: {
            description: "The chain is solana",
        },
        [ChainKey.Monad]: {
            description: "The chain is monad",
        },
        [ChainKey.Bsc]: {
            description: "The chain is bsc",
        },
        [ChainKey.Sui]: {
            description: "The chain is sui",
        },
    },
})

export enum Platform {
  Evm = "evm",
  Solana = "solana",
  Sui = "sui",
}

export const chainKeyToPlatform = (chainKey: ChainKey): Platform => {
    switch (chainKey) {
    case ChainKey.Solana:
        return Platform.Solana
    case ChainKey.Monad:
        return Platform.Evm
    case ChainKey.Bsc:
        return Platform.Evm
    case ChainKey.Sui:
        return Platform.Sui
    }
}

export enum TokenType {
  // native token
  Native = "native",
  // stable token
  Stable = "stable",
  // wrapper token
  Wrapper = "wrapper",
  // non-native token
  Regular = "regular",
}

export enum Network {
  // mainnet, for production
  Mainnet = "mainnet",
  // testnet, for testing
  Testnet = "testnet",
}

export const GraphQLTypeNetwork = createEnumType(Network)

registerEnumType(GraphQLTypeNetwork, {
    name: "Network",
    description: "The network",
    valuesMap: {
        [Network.Mainnet]: { description: "Mainnet" },
        [Network.Testnet]: { description: "Testnet" },
    },
})
