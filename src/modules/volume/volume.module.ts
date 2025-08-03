
import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./volume.module-definition"
import { VolumeService } from "./volume.service"

@Module({
    providers: [VolumeService],
    exports: [VolumeService],
})
export class VolumeModule extends ConfigurableModuleClass {}