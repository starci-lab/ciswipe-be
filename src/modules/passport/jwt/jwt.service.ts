import { Injectable } from "@nestjs/common"
import { UserLike } from "../strategies/types"
import { envConfig } from "@/modules/env/config"
import { JwtService as NestJwtService } from "@nestjs/jwt"
import { v4 } from "uuid"
import { AuthCredentials } from "./types"
import ms, { StringValue } from "ms"
import { DateService } from "@/modules/date"

@Injectable()
export class JwtAuthService {
    constructor(
        private readonly jwtService: NestJwtService,
        private readonly dateService: DateService
    ) {
        this.jwtService = new NestJwtService({
            secret: envConfig().jwt.secret,
            signOptions: { expiresIn: "1h" }
        })
    }

    public async generate(payload: Partial<UserLike>): Promise<AuthCredentials> {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: envConfig().jwt.secret,
                expiresIn: envConfig().jwt.accessTokenExpiration
            }),
            v4()
        ])
        return {
            accessToken,
            refreshToken: {
                token: refreshToken,
                expiredAt: await this.getExpiredAt()
            }
        }
    }

    public async verifyToken(token: string): Promise<UserLike | null> {
        return await this.jwtService.verifyAsync<UserLike>(token, {
            secret: envConfig().jwt.secret
        })
    }

    public async decodeToken(token: string): Promise<UserLike | null> {
        return this.jwtService.decode(token) as UserLike
    }

    private async getExpiredAt(): Promise<Date> {
        const expiresIn = envConfig().jwt.refreshTokenExpiration
        const expiresInMs = ms(expiresIn as StringValue)
        return this.dateService.getDayjs().add(expiresInMs, "millisecond").toDate()
    }
}