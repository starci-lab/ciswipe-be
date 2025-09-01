import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./orca.module-definition"
import { OrcaDexPluginService } from "./orca-plugin.service"
import { OrcaDexFetchService } from "./orca-fetch.service"
import { OrcaDexIndexerService } from "./orca-indexer.service"
import { OrcaDexInitService } from "./orca-init.service"
import { OrcaDexApiService } from "./orca-api.service"
import { OrcaDexDataService } from "./orca-data.service"
import { OrcaDexCacheService } from "./orca-cache.service"

@Module({
    providers: [
        OrcaDexPluginService,
        OrcaDexFetchService,
        OrcaDexIndexerService,
        OrcaDexInitService,
        OrcaDexApiService,
        OrcaDexDataService,
        OrcaDexCacheService,
    ],
    exports: [
        OrcaDexPluginService,
    ],
})
export class OrcaDexModule extends ConfigurableModuleClass {}