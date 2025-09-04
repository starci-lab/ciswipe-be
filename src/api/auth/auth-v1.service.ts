import { InjectMongoose } from "@/modules/databases"
import { Injectable } from "@nestjs/common"
import { Connection } from "mongoose"

@Injectable()
export class AuthV1Service {
    constructor(
        @InjectMongoose()
        private readonly connection: Connection,
    ) {}

    async handleGoogleCallback() {
        // const mongoSession = await this.connection.startSession()
        // try {
        //     let user = await this.connection.model<UserSchema>(UserSchema.name).findOne({
        //         oauthProviderId: _user.id,
        //         network: _user.network,
        //         oauthProvider: OauthProviderName.Google,
        //     }).session(session)
        // } catch (error) {
        //     throw error
        // } finally {
        //     await mongoSession.endSession()
        // }
    }
}