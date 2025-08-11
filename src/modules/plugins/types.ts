import { TokenData } from "../blockchain"
import { ChainKey, Network } from "../common"

export interface PluginMetadata {
    // plugin unique identifier
    id: string
    // plugin name
    name: string
    // plugin description
    description: string
    // plugin website
    website: string
    // plugin icon
    icon: string
}

export interface PluginAction {
    inputTokens: Array<string>
}

export interface ExecuteParams {
    // network, if not provided, use the default network
    network: Network;
    // chain key, if not provided, use the default chain key
    chainKey: ChainKey;
    // input tokens, we provide an array of tokens
    inputTokens: Array<TokenData>;
}