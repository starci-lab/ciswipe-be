import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import { BaseInputParams, BaseOutputParams } from "@/modules/blockchain"

export interface DexPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
}

// in dex, we focus on Add Liquidy, Yield Farming and ve33

export abstract class DexPluginAbstract extends BasePluginAbstract {
    private readonly dump: boolean
    constructor(
        {
            dump,
            ...superParams
        }: DexPluginAbstractConstructorParams
    ) {
        console.log(dump)
        super({
            ...superParams,
            kind: PluginKind.Dex
        })
    }

    protected abstract addLiquidityV3(
        {
            dump,
            ...coreParams
        }: AddLiquidityV3Params
    ): Promise<AddLiquidityV3OutputParams>;
}

export interface AddLiquidityV3Params extends BaseInputParams {
    dump?: boolean
}

export interface AddLiquidityV3OutputParams extends BaseOutputParams {
    dump?: boolean
}