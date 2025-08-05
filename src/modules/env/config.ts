import { join } from "path"

export const envConfig = () => ({
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || "Cuong123_A",
        ttl: parseInt(process.env.REDIS_TTL || "3600000", 10), // 3600s
    },
    volume: {
        data: {
            path: process.env.VOLUME_DATA_PATH || join(process.cwd(), ".volume", "data"),
        },
    }
})
