import { ChainKey } from "@/modules/blockchain"
import {
    AddLiquidityV3OutputParams,
    AddLiquidityV3Params,
    DexPluginAbstract,
} from "./abstract"
import { Raydium } from "@raydium-io/raydium-sdk-v2"
import { Injectable } from "@nestjs/common"

@Injectable()
export class RaydiumPlugin extends DexPluginAbstract {
    private readonly raydium: Raydium
    constructor() {
        super({
            name: "Raydium",
            icon: "https://raydium.io/favicon.ico",
            url: "https://raydium.io",
            description: "Raydium is a decentralized exchange on Solana.",
            tags: ["dex"],
            chainKeys: [ChainKey.Solana],
        })
    }

    protected async addLiquidityV3({
        dump,
        ...coreParams
    }: AddLiquidityV3Params): Promise<AddLiquidityV3OutputParams> {
        if (dump) {
            console.log("addLiquidityV3", coreParams)
        }
        this.raydium.clmm.getRpcClmmPoolInfos({
            poolIds: [],
        })
        const poolKeys = await this.raydium.api.fetchPoolByMints({
            mint1: coreParams.inputTokens[0].tokenKey,
            mint2: coreParams.inputTokens[1].tokenKey,
        })
        return {
            strategies: [],
        }
    }
}
