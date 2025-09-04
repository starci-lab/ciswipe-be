import { InjectMongoose, OauthProviderName, UserSchema } from "@/modules/databases"
import { Injectable, InternalServerErrorException } from "@nestjs/common"
import { Connection } from "mongoose"
import { UserGoogleLike } from "@/modules/passport"
import { KeypairsService } from "@/modules/blockchain"
import { AuthV1ResponseDto } from "./auth-v1.dto"
import { JwtAuthService } from "@/modules/passport"

@Injectable()
export class AuthV1Service {
    constructor(
        @InjectMongoose()
        private readonly connection: Connection,
        private readonly keypairsService: KeypairsService,
        private readonly jwtAuthService: JwtAuthService,
    ) {}

    async handleGoogleCallback(_user: UserGoogleLike): Promise<AuthV1ResponseDto> {
        const mongoSession = await this.connection.startSession()
        const result = await mongoSession.withTransaction(async (session) => {
            let user = await this.connection.model<UserSchema>(UserSchema.name).findOne({
                oauthProviderId: _user.oauthProviderId,
                network: _user.network,
                oauthProvider: OauthProviderName.Google,
            }).session(session)
            if (!user) {
                // create new user
                const keypairs = await this.keypairsService.generateKeypairs()
                const [userRaw] = await this.connection.model<UserSchema>(UserSchema.name).create([{
                    oauthProviderId: _user.oauthProviderId,
                    network: _user.network,
                    oauthProvider: OauthProviderName.Google,
                    evm: keypairs.evmKeypair,
                    sui: keypairs.suiKeypair,
                    solana: keypairs.solanaKeypair,
                }], { session })
                user = await this.connection.model<UserSchema>(UserSchema.name).findOne({
                    _id: userRaw.id,
                }).session(session)
                if (!user) {
                    throw new InternalServerErrorException("Failed to create user or find user")
                }
            }
            const { accessToken, refreshToken } = await this.jwtAuthService.generate({
                id: user._id?.toString(),
            })
            // we may store up to 10 sessions, remove the oldest one if we exceed the limit
            await this.connection.model<UserSchema>(UserSchema.name).updateOne(
                { _id: user._id },
                {
                    $push: {
                        sessions: {
                            $each: [
                                { 
                                    refreshToken: refreshToken.token, 
                                    expiredAt: refreshToken.expiredAt,
                                }
                            ],
                            $sort: { createdAt: -1 }, // sort by createdAt in descending order
                            $slice: 10                // keep only the 10 newest sessions
                        }
                    }
                },
                { session }
            )
            return { accessToken, refreshToken: refreshToken.token }
        })
        return result
    }
}