import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { BlockchainModule } from "@/modules/blockchain"
import { PluginsModule } from "@/modules/plugins"
import { EnvModule } from "@/modules/env"
import { CacheModule } from "@/modules/cache"

@Module({
    imports: [
        EnvModule.forRoot({
            isGlobal: true,
        }),
        CacheModule.register({
            isGlobal: true,
        }),
        BlockchainModule.register({
            isGlobal: true,
        }),
        PluginsModule.register({
            isGlobal: true,
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
