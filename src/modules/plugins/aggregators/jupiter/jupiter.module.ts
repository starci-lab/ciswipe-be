import { Module } from "@nestjs/common"
import { JupiterQuoteService } from "./jupiter-quote.service"
import { ConfigurableModuleClass } from "./jupiter.module-definition"

@Module({
    providers: [
        JupiterQuoteService
    ],
    exports: [
        JupiterQuoteService,
    ],
})
export class JupiterModule extends ConfigurableModuleClass {}