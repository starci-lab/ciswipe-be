import { Injectable } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"
import { LendingPluginAbstract } from "./abstract"
import { SolendLendingPluginService } from "./solend"

// lendings service
@Injectable()
export class LendingStorageService {
    constructor(
        private readonly moduleRef: ModuleRef
    ) {}

    // get all plugins
    getPlugins(): Array<LendingPluginAbstract> {
        return [
            this.moduleRef.get(SolendLendingPluginService, { strict: false })
        ]
    }
}