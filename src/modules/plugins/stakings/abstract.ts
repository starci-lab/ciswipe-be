import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    ChainKey,
    Network,
    TokenData,
} from "@/modules/blockchain"

export interface StakingPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

export interface ExecuteOutputApy {
  apy: number
  mevApy?: number
}

// in staking, we focus on input-output, and the amount in - out
export abstract class StakingPluginAbstract extends BasePluginAbstract {
    private readonly dump: boolean
    constructor({ dump, ...superParams }: StakingPluginAbstractConstructorParams) {
        console.log(dump)
        super({
            ...superParams,
            kind: PluginKind.Staking,
        })
    }

  protected abstract execute(params: ExecuteParams): Promise<ExecuteResult>;
  
  protected abstract getData(params: GetDataParams): Promise<unknown>;
}

export interface ExecuteParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputToken: TokenData;
}

export interface ExecuteResult {
  outputTokens: Array<TokenData>;
  apy: ExecuteOutputApy;
}

export interface GetDataParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputToken: TokenData;
}


