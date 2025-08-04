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
    TokenId,
} from "@/modules/blockchain"

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

  protected abstract addLiquidityV3(
    params: AddLiquidityV3Params,
  ): Promise<AddLiquidityV3OutputResult>;

  protected abstract getData(params: GetDataParams): Promise<unknown>;
}

export interface AddLiquidityV3Params {
  // network, if not provided, use the default network
  network: Network;
  // chain key, if not provided, use the default chain key
  chainKey: ChainKey;
  // input tokens, if not provided, use the default input tokens
  inputTokens: Array<TokenData>;
  // disable cache, if true, the result will not be cached
  disableCache?: boolean;
}

export interface AddLiquidityV3OutputResult {
  strategies: Array<OutputStrategy>;
}

export interface GetDataParams {
  // network, if not provided, use the default network
  network: Network;
  chainKey: ChainKey;
  // token
  token1: Token;
  token2: Token;
}

export enum OutputStrategyAprDuration {
  Day = "day",
  Week = "week",
  Month = "month",
  Year = "year",
}

export interface OutputStrategyReward {
  apr: number;
  tokenId: TokenId;
}

export interface OutputStrategyApr {
  feeApr?: number;
  rewards?: Array<OutputStrategyReward>;
  // in most case, apr = feeApr + rewardApr
  apr: number;
}

export enum OutputStrategyType {
  // dex
  AddLiquidityV3 = "addLiquidityV3",
}

export interface OutputStrategyAddLiquidityV3Metadata {
  // pool id
  poolId: string;
  // fee tier
  feeRate: number;
  // tvl
  tvl: number;
}

export interface OutputStrategy {
  // output token, if not provided, the strategy path is ended
  outputTokens?: Array<TokenData>;
  // aprs of the strategy
  aprs?: Partial<Record<OutputStrategyAprDuration, OutputStrategyApr>>;
  // metadata of the strategy
  metadata?: OutputStrategyAddLiquidityV3Metadata;
  // type
  type: OutputStrategyType;
}
