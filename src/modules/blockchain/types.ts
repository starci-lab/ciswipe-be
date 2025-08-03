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
    id: TokenId
    amount?: number
}
// core params, use in the quote to get the best investment
export interface BaseInputAddLiquidityV3Params {
    // network, if not provided, use the default network
    network: Network
    // chain key, if not provided, use the default chain key
    chainKey: ChainKey
    // input tokens, if not provided, use the default input tokens
    inputTokens: Array<TokenData>
    // disable cache, if true, the result will not be cached
    disableCache?: boolean
}

// core params, use in the quote to get the best investment
export interface BaseInputDataAddLiquidityV3Params {
    // network, if not provided, use the default network
    network: Network
    // token
    token1: Token
    token2: Token
}

export interface BaseInputDataStakeParams {
    // network, if not provided, use the default network
    network: Network
    // chain key, if not provided, use the default chain key
    chainKey: ChainKey
    // input token, if not provided, use the default input token
    inputToken: TokenData
}

export enum OutputStrategyAprDuration {
    Day = "day",
    Week = "week",
    Month = "month",
    Year = "year",
}

export interface OutputStrategyReward {
    apr: number
    tokenId: TokenId
}

export interface OutputStrategyApr {
    feeApr?: number
    rewards?: Array<OutputStrategyReward>
    // in most case, apr = feeApr + rewardApr
    apr: number
}

export enum OutputStrategyType {
    // dex
    AddLiquidityV3 = "addLiquidityV3",
}

export interface OutputStrategyAddLiquidityV3Metadata {
    // pool id
    poolId: string
    // fee tier
    feeRate: number
    // tvl
    tvl: number
}

export interface OutputStrategy {
    // output token, if not provided, the strategy path is ended
    outputTokens?: Array<TokenData>
    // aprs of the strategy
    aprs?: Partial<Record<OutputStrategyAprDuration, OutputStrategyApr>>
    // metadata of the strategy
    metadata?: OutputStrategyAddLiquidityV3Metadata
    // type
    type: OutputStrategyType
}

export interface BaseOutputAddLiquidityV3Result {
    strategies: Array<OutputStrategy>
}

export interface BaseInputStakeParams {
    // network, if not provided, use the default network
    network: Network
    // chain key, if not provided, use the default chain key
    chainKey: ChainKey
    // input tokens, if not provided, use the default input tokens
    inputToken: TokenData
}

export interface StakeOutputApy {
    apy: number
    mevApy?: number
}

export interface BaseOutputStakeResult {
    // output tokens
    outputTokens: Array<TokenData>
    apy: StakeOutputApy  
}