import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    BaseInputAddLiquidityV3Params,
    BaseInputDataAddLiquidityV3Params,
    BaseOutputAddLiquidityV3Result,
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

  protected abstract addLiquidityV3({
      dump,
      ...coreParams
  }: AddLiquidityV3Params): Promise<AddLiquidityV3OutputResult>;

  protected abstract getData({
      dump,
      ...coreParams
  }: GetDataParams): Promise<unknown>;
}

export interface AddLiquidityV3Params extends BaseInputAddLiquidityV3Params {
  dump?: boolean;
}

export interface AddLiquidityV3OutputResult
  extends BaseOutputAddLiquidityV3Result {
  dump?: boolean;
}

export interface GetDataParams extends BaseInputDataAddLiquidityV3Params {
  dump?: boolean;
}
