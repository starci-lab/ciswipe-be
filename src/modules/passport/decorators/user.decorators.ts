import { UserGoogleLike } from "../strategies/types"
import { createParamDecorator, ExecutionContext } from "@nestjs/common"

export const GoogleUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
    const ctx = context.switchToHttp().getRequest()
    return ctx.user as UserGoogleLike
})