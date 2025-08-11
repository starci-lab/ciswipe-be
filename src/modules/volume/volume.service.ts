import { Injectable, OnModuleInit } from "@nestjs/common"
import * as fsPromises from "fs/promises"
import { envConfig } from "../env"
import { join } from "path"

@Injectable()
export class VolumeService implements OnModuleInit {

    constructor(
    ) {}
    
    onModuleInit() {
        // mkdir if not exists
        fsPromises.mkdir(envConfig().volume.data.path, { recursive: true })
    }
  
    private safeFileName(name: string) {
        const parts = name.split(".")
        if (parts.length > 1) {
            const ext = parts.pop()
            const base = parts.join("_")
            return base.replace(/[^a-zA-Z0-9_]/g, "_") + "." + ext
        }
        return name.replace(/[^a-zA-Z0-9_]/g, "_")
    }

    async writeJsonToDataVolume<T>(name: string, data: T) {
        await fsPromises.writeFile(
            join(envConfig().volume.data.path, this.safeFileName(name)),
            JSON.stringify(data, null, 2)
        )
    }

    async readJsonFromDataVolume<T>(name: string): Promise<T> {
        const data = await fsPromises.readFile(join(envConfig().volume.data.path, this.safeFileName(name)))
        return JSON.parse(data.toString()) as T
    }

    async existsInDataVolume(name: string): Promise<boolean> {
        return fsPromises.access(join(envConfig().volume.data.path, this.safeFileName(name))).then(() => true).catch(() => false)
    }

    async tryActionOrFallbackToVolume<T>(
        {
            action,
            name
        }: TryActionOrFallbackToVolumeParams<T>
    ): Promise<T> {
        try {
            const result = await action()
            await this.writeJsonToDataVolume(name, result)
            return result
        } catch (error) {
            try {
                const result = await this.readJsonFromDataVolume<T>(name)
                return result
            } catch {
                throw error
            }
        }
    }
}
export interface TryActionOrFallbackToVolumeParams<T> {
    action: () => Promise<T>,
    name: string
}