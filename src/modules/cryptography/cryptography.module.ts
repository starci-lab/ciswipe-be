import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./cryptography.module-definition"
import { Sha256Service } from "./sha256.service"

@Module({
    providers: [Sha256Service],
    exports: [Sha256Service],
})
export class CryptographyModule extends ConfigurableModuleClass { }
