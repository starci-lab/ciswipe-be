import { TokenId } from "./tokens"

export enum ChainKey {
    // Solana
    Solana = "solana",
    // Monad
    Monad = "monad",
    // BSC
    Bsc = "bsc",
    // Sui
    Sui = "sui"
}

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

export interface Project {
    // project name
    name: string
    // project website
    website: string
    // project social links
    socialLinks?: Record<string, string>
}

export interface Token {
    // token id
    id: TokenId
    // token icon
    icon: string
    // token name
    name: string
    // token address, put nothing if it's a native token
    tokenAddress?: string
    // token symbol
    symbol: string
    // token decimals
    decimals: number
    // token chain key
    chainKey: ChainKey
    // token type
    type: TokenType
    // project
    project?: Project
}

export enum Network {
    // mainnet, for production
    Mainnet = "mainnet",
    // testnet, for testing
    Testnet = "testnet",
}

export interface TokenData {
    id?: TokenId
    tokenAddress?: string
    amount?: number
}