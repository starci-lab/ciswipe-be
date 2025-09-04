import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./auth.module-definition"
import { AuthV1Controller } from "./auth-v1.controller"

@Module({
    controllers: [AuthV1Controller],
})
export class AuthModule extends ConfigurableModuleClass {}