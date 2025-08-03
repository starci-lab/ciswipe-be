import {
    BasePluginAbstract,
    BasePluginAbstractConstructorParams,
    PluginKind,
} from "../abstract"
import {
    BaseInputDataStakeParams,
    BaseInputStakeParams,
    BaseOutputStakeResult,
} from "@/modules/blockchain"

export interface StakingPluginAbstractConstructorParams
  extends Omit<BasePluginAbstractConstructorParams, "kind"> {
  dump?: boolean;
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

  protected abstract stake({
      dump,
      ...coreParams
  }: StakeParams): Promise<StakeOutputResult>;
  
  protected abstract getData({
      dump,
      ...coreParams
  }: GetDataParams): Promise<unknown>;
}

export interface StakeParams extends BaseInputStakeParams {
  dump?: boolean;
}

export interface StakeOutputResult extends BaseOutputStakeResult {
  dump?: boolean;
}

export interface GetDataParams extends BaseInputDataStakeParams {
  dump?: boolean;
}


