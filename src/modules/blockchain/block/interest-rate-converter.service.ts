import { Network } from "@/modules/common"
import { ChainKey } from "@/modules/common"
import { Injectable } from "@nestjs/common"
import { blocksPerYear } from "./blocks"
import { Decimal } from "decimal.js"

@Injectable()
export class InterestRateConverterService    {
    constructor() {}

    public toAPY(apr: Decimal, chainKey: ChainKey, network: Network) {
        return new Decimal(1)
            .plus(new Decimal(apr).dividedBy(blocksPerYear[chainKey][network]))
            .pow(blocksPerYear[chainKey][network])
            .minus(1)
    }

    public toAPR(apy: Decimal, chainKey: ChainKey, network: Network) {
        return apy
            .plus(1)
            .pow(new Decimal(1).dividedBy(blocksPerYear[chainKey][network]))
            .minus(1)
            .times(blocksPerYear[chainKey][network])
    }
}