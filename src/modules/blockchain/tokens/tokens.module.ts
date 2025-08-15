import { Module } from "@nestjs/common"
import { TokenUtilsService } from "./token-utils.service"
import { ConfigurableModuleClass } from "./tokens.module-definition"

@Module({
    providers: [TokenUtilsService],
    exports: [TokenUtilsService],
})
export class TokensModule extends ConfigurableModuleClass {}