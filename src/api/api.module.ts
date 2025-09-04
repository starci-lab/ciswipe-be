import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./api.module-definition"
import { AuthModule } from "./auth"

@Module({
    imports: [AuthModule],
})
export class ApiModule extends ConfigurableModuleClass {}