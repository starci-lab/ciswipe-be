import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import { Network, ChainKey, StrategyResult } from "@/modules/common"
import { TokenId } from "@/modules/blockchain"
import { ExecuteParams } from "../types"

export interface VaultPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in staking, we focus on input-output, and the amount in - out
export abstract class VaultPluginAbstract extends BasePluginAbstract {
    constructor({ ...superParams }: VaultPluginAbstractConstructorParams) {
        super({
            ...superParams,
            kind: PluginKind.Vault,
        })
    }

  // execute
  public abstract execute(
    params: ExecuteParams,
  ): Promise<Array<StrategyResult>>;
  // supported chain keys
  public abstract getChainKeys(): Array<ChainKey>;
  // supported token ids
  public abstract getTokenIds(): Record<Network, Array<TokenId>>;
}
