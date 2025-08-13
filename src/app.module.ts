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
import { GraphQLModule as NestGraphQLModule } from "@nestjs/graphql"
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { GraphQLModule } from "@/graphql"
import { CoreModule } from "@/modules/core"
import { AIModule } from "./modules/ai"
import GraphQLJSON from "graphql-type-json"
import { ProbabilityStatisticsModule } from "@/modules/probability-statistics"
import { CryptographyModule } from "@/modules/cryptography"

@Module({
    imports: [
        EnvModule.forRoot({
            isGlobal: true,
        }),
        CryptographyModule.register({
            isGlobal: true
        }),
        HttpModule.register({
            global: true,
        }),
        ProbabilityStatisticsModule.register({
            isGlobal: true,
        }),
        VolumeModule.register({
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),
        CacheModule.register({
            isGlobal: true,
        }),
        AIModule.register({
            isGlobal: true,
        }),
        BlockchainModule.register({
            isGlobal: true,
        }),
        PluginsModule.register({
            isGlobal: true,
        }),
        CoreModule.register({
            isGlobal: true,
        }),
        NestGraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            playground: false,
            autoSchemaFile: true,
            plugins: [ApolloServerPluginLandingPageLocalDefault()],
            resolvers: { JSON: GraphQLJSON },
        }),
        GraphQLModule.register({
            isGlobal: true,
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
