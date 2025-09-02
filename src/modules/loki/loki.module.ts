import { Module } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./loki.module-definition"
import { utilities, WinstonModule } from "nest-winston"
import winston from "winston"
import LokiTransport from "winston-loki"
import { envConfig } from "@/modules/env"

@Module({})
export class LokiModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE) {
        const dynamicModule = super.register(options)
        const winstonModule = WinstonModule.forRoot({
            level: "debug",
            levels: {
                fatal: 0,
                error: 1,
                warn: 2,
                info: 3,
                verbose: 4,
                debug: 5,
            },
            transports: [
                // write to console
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                        utilities.format.nestLike("CiSwipe", {
                            colors: true,
                            prettyPrint: true,
                            appName: true,
                            processId: true
                        }),
                    ),
                }),
                // write to loki
                new LokiTransport({
                    host: envConfig().loki.host,
                    json: true,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.ms(),
                        winston.format.json(),
                    ),
                    labels: {
                        environment: envConfig().isProduction,
                        application: "ciswipe",
                    },
                    basicAuth: envConfig().loki.requireAuth
                        ? `${envConfig().loki.username}:${envConfig().loki.password}`
                        : undefined,
                }),
            ],
        })
        return {
            ...dynamicModule,
            imports: [winstonModule],
            exports: [winstonModule],
        }
    }
}
