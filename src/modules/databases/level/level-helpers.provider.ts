import { Inject, Injectable } from "@nestjs/common"
import { LEVEL_PROVIDER_TOKEN } from "./level.providers"
import { Network } from "@/modules/common"
import { Level } from "level"

export interface GetOrFetchFromLevelParams<T> {
    action: () => Promise<T>;
    levelKey: string;
    network: Network;
    ttlMs?: number; // optional, default = no expiration
}

export interface SetLevelDbDataParams<T> {
    levelKey: string;
    network: Network;
    data: T;
}

export interface LevelDbData<T> {
    value: T;
    expiresAt?: number;
}

export interface FetchFromLevelParams {
    levelKey: string;
    network: Network;
}

@Injectable()
export class LevelHelpersService {
    constructor(
        @Inject(LEVEL_PROVIDER_TOKEN)
        private readonly levelDatabase: Record<Network, Level>,
    ) {}

    createLevelDbData<T>(value: T, ttlMs?: number): LevelDbData<T> {
        return ttlMs
            ? { value, expiresAt: Date.now() + ttlMs }
            : { value }
    }

    // create key like sui
    createKey(...args: Array<string>) {
        return args.join("::")
    }

    // return null if key not found
    async fetchFromLevel<T>({
        levelKey,
        network,
    }: FetchFromLevelParams): Promise<T | null> {
        const hasKey = await this.levelDatabase[network].has(levelKey)
        if (hasKey) {
            const stringResult = await this.levelDatabase[network].get(levelKey)
            const parsed = JSON.parse(stringResult) as LevelDbData<T>
            if (!parsed.expiresAt || parsed.expiresAt > Date.now()) {
                return parsed.value
            }
        }
        return null
    }

    // return null if key not found
    async getOrFetchFromLevel<T>({
        action,
        levelKey,
        network,
        ttlMs,
    }: GetOrFetchFromLevelParams<T>): Promise<T> {
        const hasKey = await this.levelDatabase[network].has(levelKey)
        if (hasKey) {
            const stringResult = await this.levelDatabase[network].get(levelKey)
            const parsed = JSON.parse(stringResult) as LevelDbData<T>
            if (!parsed.expiresAt || parsed.expiresAt > Date.now()) {
                return parsed.value
            }
        }
        const result = await action()
        const payload: LevelDbData<T> = this.createLevelDbData(result, ttlMs)
        await this.levelDatabase[network].put(levelKey, JSON.stringify(payload))
        return result
    }

    async setLevelDbData<T>({
        levelKey,
        network,
        data,
    }: SetLevelDbDataParams<T>): Promise<void> {
        const payload: LevelDbData<T> = this.createLevelDbData(data)
        await this.levelDatabase[network].put(levelKey, JSON.stringify(payload))
    }
}