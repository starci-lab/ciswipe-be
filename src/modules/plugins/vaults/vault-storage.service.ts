import { Injectable } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"
import { KaminoVaultPluginService } from "./kamino"
import { VaultPluginAbstract } from "./abstract"

// lendings service
@Injectable()
export class VaultStorageService {
    constructor(
        private readonly moduleRef: ModuleRef
    ) {}

    // get all plugins
    getPlugins(): Array<VaultPluginAbstract> {
        return [
            this.moduleRef.get(KaminoVaultPluginService, { strict: false })
        ]
    }
}