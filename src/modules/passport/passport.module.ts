import { Module } from "@nestjs/common"
import { GoogleAuthStrategy, JwtAuthStrategy } from "./strategies"
import { PassportModule as NestPassportModule } from "@nestjs/passport"
import { ConfigurableModuleClass } from "./passport.module-definition"
import { JwtAuthService } from "./jwt"
import { JwtModule } from "@nestjs/jwt"
@Module({
    imports: [NestPassportModule, JwtModule],
    providers: [GoogleAuthStrategy, JwtAuthStrategy, JwtAuthService],
    exports: [JwtAuthService],
})
export class PassportModule extends ConfigurableModuleClass {}