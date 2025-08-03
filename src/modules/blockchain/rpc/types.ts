import { ChainKey, Network } from "../types"

export const createProviderToken = (chainKey: ChainKey) => {
    return `${chainKey.toLowerCase()}-rpc-provider` as const
}

export type RecordRpcProvider<T> = Record<Network, T>