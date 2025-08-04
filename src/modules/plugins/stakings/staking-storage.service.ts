import { Injectable } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"
import { JitoPluginService } from "./jito"
import { StakingPluginAbstract } from "./abstract"

// stakings service
@Injectable()
export class StakingStorageService {
    constructor(
        private readonly moduleRef: ModuleRef
    ) {}

    // get all plugins
    getPlugins(): Array<StakingPluginAbstract> {
        return [
            this.moduleRef.get(JitoPluginService)
        ]
    }
}