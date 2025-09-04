import { Network } from "@/modules/common"

export interface UserLike {
    email: string
    username: string
    picture: string
    id?: string
    network: Network
    referralUserId?: string
}

export interface UserGoogleLike extends UserLike {
    oauthProviderId: string
}

export type UserJwtLike = UserLike