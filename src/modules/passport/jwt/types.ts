export interface RefreshToken {
    token: string
    expiredAt: Date
}

export interface AuthCredentials {
    accessToken: string
    refreshToken: RefreshToken
}