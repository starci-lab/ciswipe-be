import { Inject } from "@nestjs/common"
import { WINSTON_MODULE_PROVIDER } from "nest-winston"

export const InjectWinstonLogging = () => Inject(WINSTON_MODULE_PROVIDER)