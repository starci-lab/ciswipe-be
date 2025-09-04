import { Network } from "@/modules/common"

export type UserGoogleLike = {
    email: string
    username: string
    picture: string
    id: string
    network: Network
    referralUserId?: string
}