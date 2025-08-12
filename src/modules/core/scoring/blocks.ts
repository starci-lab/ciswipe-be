import { ChainKey, Network } from "@/modules/common"

export const blocksPerYear = {
    [ChainKey.Solana]: {
        [Network.Mainnet]: 2 * 60 * 60 * 24 * 365,       // 2 blocks/ 1s * 60s * 60p * 24h * 365d = 63,072,000
        [Network.Testnet]: 2 * 60 * 60 * 24 * 365,
    },
    [ChainKey.Monad]: {
        [Network.Mainnet]: 2 * 60 * 60 * 24 * 365,       // If like solana
        [Network.Testnet]: 2 * 60 * 60 * 24 * 365,
    },
    [ChainKey.Bsc]: {
        [Network.Mainnet]: (1 / 3) * 60 * 60 * 24 * 365, // 1 block / 3s
        [Network.Testnet]: (1 / 3) * 60 * 60 * 24 * 365,
    },
    [ChainKey.Sui]: {
        [Network.Mainnet]: 1 * 60 * 60 * 24 * 365, // 1 block / 1s
        [Network.Testnet]: 1 * 60 * 60 * 24 * 365,
    },
}

export const slotPerDay = {
    base: 1,
}