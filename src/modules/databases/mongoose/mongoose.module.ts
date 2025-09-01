import { DynamicModule, Module } from "@nestjs/common"
import { StorageSchema, StorageSchemaClass } from "./schemas"
import { MongooseModule as NestMongooseModule } from "@nestjs/mongoose"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mongoose.module-definition"
import { envConfig } from "@/modules/env"
import { Connection } from "mongoose"
import { normalizeMongoose } from "./plugins"
import { MongooseStorageHelpersService } from "./mongoose-storage-helpers.service"

@Module({})
export class MongooseModule extends ConfigurableModuleClass {
    public static forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
        const dynamicModule = super.forRoot(options)

        const { dbName, host, password, port, username } =
            envConfig().databases.mongoose
        const url = `mongodb://${username}:${password}@${host}:${port}`
        return {
            ...dynamicModule,
            imports: [
                NestMongooseModule.forRoot(url, {
                    retryWrites: true,
                    retryReads: true,
                    authSource: "admin",
                    dbName,
                    connectionFactory: async (connection: Connection) => {
                        connection.plugin(normalizeMongoose)
                        return connection
                    }, 
                }),
                this.forFeature()
            ],
            providers: [
                MongooseStorageHelpersService
            ],
            exports: [
                MongooseStorageHelpersService
            ]
        }
    }

    private static forFeature(): DynamicModule {
        return {
            module: MongooseModule,
            imports: [
                NestMongooseModule.forFeatureAsync(
                    [
                        {
                            name: StorageSchema.name,
                            useFactory: () => StorageSchemaClass
                        },
                    ],
                )
            ]
        }
    }
}