import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./ai.module-definition"
import { DeepseekService } from "./deepseek.service"

@Module({
    providers: [DeepseekService],
    exports: [DeepseekService],
})
export class AiModule extends ConfigurableModuleClass { }
