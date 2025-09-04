import { Module } from "@nestjs/common"
import { GoogleAuthStrategy } from "./strategies"
import { PassportModule as NestPassportModule } from "@nestjs/passport"
import { ConfigurableModuleClass } from "./passport.module-definition"
@Module({
    imports: [NestPassportModule],
    providers: [GoogleAuthStrategy],
    exports: [],
})
export class PassportModule extends ConfigurableModuleClass {}