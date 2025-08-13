import { Module } from "@nestjs/common"
import { InterestRateConverterService } from "./interest-rate-converter.service"
import { ConfigurableModuleClass } from "./block.module-definition"

@Module({
    providers: [InterestRateConverterService],
    exports: [InterestRateConverterService],
})
export class BlockModule extends ConfigurableModuleClass {}
