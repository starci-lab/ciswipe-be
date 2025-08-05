import { registerEnumType, ObjectType, Field } from "@nestjs/graphql"
import { createEnumType, ChainKey, Network, TokenType } from "@/modules/common"

export enum TokenId {
  SolanaSolMainnet = "solana-sol-mainnet",
  SolanaWsolMainnet = "solana-wsol-mainnet",
  SolanaMsolMainnet = "solana-msol-mainnet",
  SolanaJupMainnet = "solana-jup-mainnet",
  SolanaUsdcMainnet = "solana-usdc-mainnet",
  SolanaSolTestnet = "solana-sol-testnet",
  SolanaWsolTestnet = "solana-wsol-testnet",
  SolanaRayMainnet = "solana-ray-mainnet",
  SolanaJitoSolMainnet = "solana-jito-sol-mainnet",
  SuiSuiMainnet = "sui-sui-mainnet",
  SuiUsdcMainnet = "sui-usdc-mainnet",
  SuiUsdcWormholeMainnet = "sui-usdc-wormhole-mainnet",
  SuiSuiTestnet = "sui-sui-testnet",
  SuiUsdcTestnet = "sui-usdc-testnet",
  SuiCetusMainnet = "sui-cetus-mainnet",
}

@ObjectType()
export class TokenData {
  @Field(() => String, { nullable: true, description: "The token id" })
      id?: TokenId
  @Field(() => String, { nullable: true, description: "The token address" })
      tokenAddress?: string
  @Field(() => Number, { nullable: true, description: "The token amount" })
      amount?: number
}

// temporary file
export interface Project {
    // project name
    name: string;
    // project website
    website: string;
    // project social links
    socialLinks?: Record<string, string>;
}

export interface Token {
    // token id
    id: TokenId;
    // token icon
    icon: string;
    // token name
    name: string;
    // token address, put nothing if it's a native token
    tokenAddress?: string;
    // token symbol
    symbol: string;
    // token decimals
    decimals: number;
    // token chain key
    chainKey: ChainKey;
    // token type
    type: TokenType;
    // project
    project?: Project;
}

export const GraphQLTypeTokenId = createEnumType(TokenId)

registerEnumType(GraphQLTypeTokenId, {
    name: "TokenId",
    description: "The token id",
    valuesMap: {
        [TokenId.SolanaSolMainnet]: { description: "Solana SOL" },
        [TokenId.SolanaWsolMainnet]: { description: "Solana wSOL" },
        [TokenId.SolanaMsolMainnet]: { description: "Solana mSOL" },
        [TokenId.SolanaJupMainnet]: { description: "Solana JUP" },
        [TokenId.SolanaUsdcMainnet]: { description: "Solana USDC" },
        [TokenId.SolanaSolTestnet]: { description: "Solana SOL Testnet" },
        [TokenId.SolanaWsolTestnet]: { description: "Solana wSOL Testnet" },
        [TokenId.SolanaRayMainnet]: { description: "Solana RAY" },
        [TokenId.SolanaJitoSolMainnet]: { description: "Solana Jito" },
        [TokenId.SuiSuiMainnet]: { description: "Sui SUI" },
        [TokenId.SuiUsdcMainnet]: { description: "Sui USDC" },
        [TokenId.SuiUsdcWormholeMainnet]: { description: "Sui USDC (Wormhole)" },
        [TokenId.SuiSuiTestnet]: { description: "Sui SUI Testnet" },
        [TokenId.SuiUsdcTestnet]: { description: "Sui USDC Testnet" },
        [TokenId.SuiCetusMainnet]: { description: "Sui CETUS" },
    },
})

export const tokens: Record<ChainKey, Record<Network, Array<Token>>> = {
    [ChainKey.Solana]: {
        [Network.Mainnet]: [
            {
                id: TokenId.SolanaSolMainnet,
                icon: "https://solana.com/img/solana-logo.png",
                name: "Solana",
                symbol: "SOL",
                decimals: 9,
                chainKey: ChainKey.Solana,
                type: TokenType.Native,
            },
            {
                id: TokenId.SolanaWsolMainnet,
                icon: "https://solana.com/img/solana-logo.png",
                name: "Solana",
                tokenAddress: "So11111111111111111111111111111111111111112",
                symbol: "wSOL",
                decimals: 9,
                chainKey: ChainKey.Solana,
                type: TokenType.Wrapper,
            },
            {
                id: TokenId.SolanaMsolMainnet,
                icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/icon.png",
                name: "Marinade Staked SOL",
                symbol: "mSOL",
                tokenAddress: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
                decimals: 9,
                chainKey: ChainKey.Solana,
                type: TokenType.Regular,
            },
            {
                id: TokenId.SolanaJupMainnet,
                icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB/icon.png",
                name: "Jupiter",
                symbol: "JUP",
                tokenAddress: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
                decimals: 6,
                chainKey: ChainKey.Solana,
                type: TokenType.Regular,
            },
            {
                id: TokenId.SolanaUsdcMainnet,
                icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/icon.png",
                name: "USD Coin",
                symbol: "USDC",
                tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                decimals: 6,
                chainKey: ChainKey.Solana,
                type: TokenType.Stable,
            },
            {
                id: TokenId.SolanaRayMainnet,
                icon: "https://img-v1.raydium.io/icon/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png",
                name: "Raydium",
                symbol: "RAY",
                tokenAddress: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
                decimals: 6,
                chainKey: ChainKey.Solana,
                type: TokenType.Regular,
            },
            {
                id: TokenId.SolanaJitoSolMainnet,
                icon: "https://jito.io/favicon.ico",
                name: "Jito",
                symbol: "Jito",
                tokenAddress: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
                decimals: 9,
                chainKey: ChainKey.Solana,
                type: TokenType.Regular,
            },
        ],
        [Network.Testnet]: [
            {
                id: TokenId.SolanaSolTestnet,
                icon: "https://solana.com/img/solana-logo.png",
                name: "Solana",
                symbol: "SOL",
                decimals: 9,
                chainKey: ChainKey.Solana,
                type: TokenType.Native,
            },
            {
                id: TokenId.SolanaWsolTestnet,
                icon: "https://solana.com/img/solana-logo.png",
                name: "Solana",
                symbol: "wSOL",
                tokenAddress: "So11111111111111111111111111111111111111112",
                decimals: 9,
                chainKey: ChainKey.Solana,
                type: TokenType.Wrapper,
            },
        ],
    },
    [ChainKey.Monad]: {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    },
    [ChainKey.Bsc]: {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    },
    [ChainKey.Sui]: {
        [Network.Mainnet]: [
            {
                id: TokenId.SuiSuiMainnet,
                icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png", // SUI logo
                name: "Sui",
                symbol: "SUI",
                tokenAddress:
          "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                decimals: 9,
                chainKey: ChainKey.Sui,
                type: TokenType.Native,
            },
            {
                id: TokenId.SuiUsdcMainnet,
                icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png", // USDC logo
                name: "USD Coin",
                symbol: "USDC",
                tokenAddress:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
                decimals: 6,
                chainKey: ChainKey.Sui,
                type: TokenType.Stable,
            },
            {
                id: TokenId.SuiUsdcWormholeMainnet,
                icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png", // USDC logo
                name: "USD Coin (Wormhole)",
                symbol: "USDC",
                tokenAddress:
          "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                decimals: 6,
                chainKey: ChainKey.Sui,
                type: TokenType.Stable,
            },
            {
                id: TokenId.SuiCetusMainnet,
                icon: "https://cetus.zone/favicon.ico",
                name: "Cetus",
                symbol: "CETUS",
                tokenAddress:
          "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
                decimals: 9,
                chainKey: ChainKey.Sui,
                type: TokenType.Regular,
            },
        ],
        [Network.Testnet]: [
            {
                id: TokenId.SuiSuiTestnet,
                icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png",
                name: "Sui",
                symbol: "SUI",
                tokenAddress: "0x2::sui::SUI",
                decimals: 9,
                chainKey: ChainKey.Sui,
                type: TokenType.Native,
            },
            {
                id: TokenId.SuiUsdcTestnet,
                icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
                name: "USD Coin",
                symbol: "USDC",
                tokenAddress:
          "0x9007e2c4c1a20f5ff1dd6ec8e2cc5ae04928e2eb06fa1c708ba84c5f5a68f82a::coin::COIN",
                decimals: 6,
                chainKey: ChainKey.Sui,
                type: TokenType.Stable,
            },
        ],
    },
}
