import { TokenData } from "@/modules/blockchain"
import { ChainKey, Network } from "@/modules/common"

export interface ExecuteParams {
    // network, if not provided, use the default network
    network: Network;
    // chain key, if not provided, use the default chain key
    chainKey: ChainKey;
    // input tokens, we provide an array of tokens
    inputTokens: Array<TokenData>;
}   