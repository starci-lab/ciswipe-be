import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    ChainKey,
    Network,
} from "@/modules/common"
import { Token, TokenData } from "@/modules/blockchain"

export interface LendingPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in staking, we focus on input-output, and the amount in - out
export abstract class LendingPluginAbstract extends BasePluginAbstract {
    constructor({
        ...superParams
    }: LendingPluginAbstractConstructorParams) {
        super({
            ...superParams,
            kind: PluginKind.Lending,
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
  // disable cache, if not provided, use the default disable cache
  disableCache?: boolean;
}

export interface LendingOutputApr {
  apr: number;
}

export interface LendingOutputStrategyMetadata {
  // vault id
  vaultId: string;
}

export enum LendingOutputStrategyType {
  // lending
  Lending = "lending",
}

export interface ExecuteStrategy {
  // output token, if not provided, the strategy path is ended
  outputTokens?: Array<TokenData>;
  // apr of the strategy
  apr?: LendingOutputApr;
  // metadata of the strategy
  metadata?: LendingOutputStrategyMetadata;
  // type
  type: LendingOutputStrategyType;
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
  inputToken: Token;
}