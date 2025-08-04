import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    ChainKey,
    Network,
    Token,
    TokenData,
} from "@/modules/blockchain"

export interface VaultPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in staking, we focus on input-output, and the amount in - out
export abstract class VaultPluginAbstract extends BasePluginAbstract {
    constructor({
        ...superParams
    }: VaultPluginAbstractConstructorParams) {
        super({
            ...superParams,
            kind: PluginKind.Vault,
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
  inputTokens: Array<TokenData>;
  // disable cache, if not provided, use the default disable cache
  disableCache?: boolean;
}

export interface ExecuteApr {
  apr: number;
}

export interface ExecuteStrategyMetadata {
  // vault id
  vaultId: string;
}

export interface ExecuteStrategy {
  // output token, if not provided, the strategy path is ended
  outputTokens?: Array<TokenData>;
  // apr of the strategy
  apr?: ExecuteApr;
  // metadata of the strategy
  metadata?: ExecuteStrategyMetadata;
}

export interface ExecuteResult {
  strategies: Array<ExecuteStrategy>;
}

export interface GetDataParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputTokens: Array<Token>;
}