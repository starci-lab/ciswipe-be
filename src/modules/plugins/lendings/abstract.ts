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

export interface LendingPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in staking, we focus on input-output, and the amount in - out
export abstract class LendingPluginAbstract extends BasePluginAbstract {
    private readonly dump: boolean
    constructor({
        dump,
        ...superParams
    }: LendingPluginAbstractConstructorParams) {
        console.log(dump)
        super({
            ...superParams,
            kind: PluginKind.Lending,
        })
    }

  protected abstract lend(params: LendParams): Promise<LendingOutputResult>;
  protected abstract getData(params: GetDataParams): Promise<unknown>;
}

export interface LendParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputToken: TokenData;
  // disable cache, if not provided, use the default disable cache
  disableCache?: boolean;
}

export interface LendingOutputApy {
  apy: number;
  netApy?: number;
}

export interface LendingOutputStrategyMetadata {
  // vault id
  vaultId: string;
}

export enum LendingOutputStrategyType {
  // lending
  Lending = "lending",
}

export interface LendingOutputStrategy {
  // output token, if not provided, the strategy path is ended
  outputTokens?: Array<TokenData>;
  // apy of the strategy
  apy?: LendingOutputApy;
  // metadata of the strategy
  metadata?: LendingOutputStrategyMetadata;
  // type
  type: LendingOutputStrategyType;
}

export interface LendingOutputResult {
  strategies: Array<LendingOutputStrategy>;
}

export interface GetDataParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputToken: Token;
}
