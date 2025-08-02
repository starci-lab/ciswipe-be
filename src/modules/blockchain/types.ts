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

export interface Token {
    // token id
    id: string
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
}

export enum Network {
    // mainnet, for production
    Mainnet = "mainnet",
    // testnet, for testing
    Testnet = "testnet",
}

export interface TokenAmount {
    tokenKey: string
    amount: number
}
// core params, use in the quote to get the best investment
export interface BaseInputParams {
    // network, if not provided, use the default network
    network: Network
    // chain key, if not provided, use the default chain key
    chainKey: ChainKey
    // input tokens, if not provided, use the default input tokens
    inputTokens: Array<TokenAmount>
}

export interface OutputStrategy {
    // output token, if not provided, use the default output token
    outputTokens: Array<TokenAmount>
    // apr of the strategy
    apr: number
}

export interface BaseOutputParams {
    strategies: Array<OutputStrategy>
}