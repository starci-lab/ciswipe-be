import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import { Network, ChainKey, StrategyResult } from "@/modules/common"
import { TokenData } from "@/modules/blockchain"

export interface StakingPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in staking, we focus on input-output, and the amount in - out
export abstract class StakingPluginAbstract extends BasePluginAbstract {
    constructor({ ...superParams }: StakingPluginAbstractConstructorParams) {
        super({
            ...superParams,
            kind: PluginKind.Staking,
        })
    }

  protected abstract execute(
    params: ExecuteParams,
  ): Promise<Array<StrategyResult>>;
}

export interface ExecuteParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputTokens: Array<TokenData>;
}
