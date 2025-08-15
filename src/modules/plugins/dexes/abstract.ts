import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    ChainKey,
    Network,
    StrategyResult,
} from "@/modules/common"
import { Token, TokenData } from "@/modules/blockchain"

export interface DexPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in dex, we focus on Add Liquidy, Yield Farming and ve33

export abstract class DexPluginAbstract extends BasePluginAbstract {
    private readonly dump: boolean
    constructor({ ...superParams }: DexPluginAbstractConstructorParams) {
        super({
            ...superParams,
            kind: PluginKind.Dex,
        })
    }

  protected abstract v3Execute(
    params: V3ExecuteParams,
  ): Promise<Array<StrategyResult>>;
}

export interface V3ExecuteParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputTokens: Array<TokenData>;
}

export interface V3ExecuteSingleParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputTokens: Array<TokenData>;
}

export interface GetDataParams {
  // network, if not provided, use the default network
  network: Network;
  chainKey: ChainKey;
  // token
  token1: Token;
  token2: Token;
}

export enum V3StrategyAprDuration {
  Day = "day",
  Week = "week",
  Month = "month",
  Year = "year",
}