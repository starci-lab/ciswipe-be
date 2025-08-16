import { Inject, Injectable, OnApplicationBootstrap, OnModuleInit } from "@nestjs/common"
import { LEVEL_PROVIDER_TOKEN } from "./level.providers"
import { Level } from "level"
import { Network } from "@/modules/common"

@Injectable()
export class LevelSubscriptionService implements OnModuleInit, OnApplicationBootstrap {
    constructor(
        @Inject(LEVEL_PROVIDER_TOKEN)
        private readonly levelDatabase: Record<Network, Level>,     
    ) { }

    // we try to mock a put event
    async onApplicationBootstrap() {
        this.levelDatabase[Network.Mainnet].put("test", "test")
    }

    async onModuleInit() {
        for (const network of Object.values(Network)) {
            this.levelDatabase[network]
                .on("write", (
                    //key, 
                    //value
                ) => {
                    // when we run master - slave model in scale up, we will
                    // implements logic later
                })
        }
    }
}   