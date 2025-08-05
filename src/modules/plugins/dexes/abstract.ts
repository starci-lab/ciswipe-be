import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    ChainKey,
    Network,
} from "@/modules/common"
import { Token, TokenData, TokenId } from "@/modules/blockchain"

export interface DexPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in dex, we focus on Add Liquidy, Yield Farming and ve33

export abstract class DexPluginAbstract extends BasePluginAbstract {
    private readonly dump: boolean
    constructor({ dump, ...superParams }: DexPluginAbstractConstructorParams) {
        console.log(dump)
        super({
            ...superParams,
            kind: PluginKind.Dex,
        })
    }

  protected abstract v3Execute(
    params: V3ExecuteParams,
  ): Promise<V3ExecuteResult>;

  protected abstract getData(params: GetDataParams): Promise<unknown>;
}

export interface V3ExecuteParams {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputTokens: Array<TokenData>;
  // disable cache, if true, the result will not be cached
  disableCache?: boolean;
}

export interface V3ExecuteResult {
  strategies: Array<V3Strategy>;
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

export interface StrategyReward {
  apr: number;
  tokenId: TokenId;
}

export interface V3StrategyApr {
  feeApr?: number;
  rewards?: Array<StrategyReward>;
  // in most case, apr = feeApr + rewardApr
  apr: number;
}

export enum StrategyType {
  // dex
  AddLiquidityV3 = "addLiquidityV3",
}

export interface StrategyV3Metadata {
  // pool id
  poolId: string;
  // fee tier
  feeRate: number;
  // tvl
  tvl: number;
}

export interface V3Strategy {
  // output token, if not provided, the strategy path is ended
  outputTokens?: Array<TokenData>;
  // aprs of the strategy
  aprs?: Partial<Record<V3StrategyAprDuration, V3StrategyApr>>;
  // metadata of the strategy
  metadata?: StrategyV3Metadata;
  // type
  type: StrategyType;
}
