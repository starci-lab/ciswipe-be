import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { BlockchainModule } from "@/modules/blockchain"
import { PluginsModule } from "@/modules/plugins"
import { EnvModule } from "@/modules/env"
import { CacheModule } from "@/modules/cache"
import { ScheduleModule } from "@nestjs/schedule"
import { HttpModule } from "@nestjs/axios"
import { VolumeModule } from "@/modules/volume"

@Module({
    imports: [
        EnvModule.forRoot({
            isGlobal: true,
        }),
        HttpModule.register({
            global: true,
        }),
        VolumeModule.register({
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),
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
