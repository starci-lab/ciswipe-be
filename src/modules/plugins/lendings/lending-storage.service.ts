import { Injectable } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"
import { KaminoPluginService } from "./kamino"
import { LendingPluginAbstract } from "./abstract"

// lendings service
@Injectable()
export class LendingStorageService {
    constructor(
        private readonly moduleRef: ModuleRef
    ) {}

    // get all plugins
    getPlugins(): Array<LendingPluginAbstract> {
        return [
            this.moduleRef.get(KaminoPluginService)
        ]
    }
}