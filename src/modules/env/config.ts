import { join } from "path"

export const envConfig = () => ({
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || "Cuong123_A",
        ttl: parseInt(process.env.REDIS_TTL || "3600000", 10), // 3600s
    },
    databases: {
        mongoose: {
            host: process.env.MONGOOSE_HOST || "localhost",
            port: parseInt(process.env.MONGOOSE_PORT || "27018", 10),
            password: process.env.MONGOOSE_PASSWORD || "Cuong123_A",
            username: process.env.MONGOOSE_USERNAME || "root",
            dbName: process.env.MONGOOSE_DB_NAME || "ciswipe",
        },
    },
    volume: {
        data: {
            path: process.env.VOLUME_DATA_PATH || join(process.cwd(), ".volume", "data"),
        },
    },
    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || "",
        apiUrl: process.env.DEEPSEEK_API_URL || "https://api.deepseek.ai/v1/analyze",
    },
    debug: {
        kaminoVaultFetch: Boolean(process.env.KAMINO_VAULT_FETCH_DEBUG) || true,
    },
    cryptography: {
        sha256Salt: process.env.SHA256_SALT || "ciswipesha256",
    }
})
