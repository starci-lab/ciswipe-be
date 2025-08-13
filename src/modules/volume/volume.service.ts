import { Injectable, OnModuleInit } from "@nestjs/common"
import * as fsPromises from "fs/promises"
import { envConfig } from "../env"
import { join } from "path"
import dayjs from "dayjs"

export interface FileContent<T = unknown> {
    data: T;
    timeout: string;
}
    
@Injectable()
export class VolumeService implements OnModuleInit {
    constructor() {}

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

    async writeJsonToDataVolume<T>(
        name: string,
        data: T,
        // timeout = 15min, to ensure the application do not load data instanly after each reboot
        timeout = 1000 * 60 * 15,
    ) {
        const fileContent: FileContent<T> = {
            data: data,
            timeout: dayjs().add(timeout, "ms").toISOString(),
        }
        await fsPromises.writeFile(
            join(envConfig().volume.data.path, this.safeFileName(name)),
            JSON.stringify(fileContent, null, 2),
        )
    }

    async readJsonFromDataVolume<T>(name: string): Promise<T> {
        const filePath = join(envConfig().volume.data.path, this.safeFileName(name))
        const raw = await fsPromises.readFile(filePath, "utf-8")
        const fileContent = JSON.parse(raw) as FileContent<T>
        return fileContent.data
    }

    async updateJsonFromDataVolume<T>(
        name: string,
        updateFn: (prevData: T) => T
    ): Promise<void> {
        const prevData = await this.readJsonFromDataVolume<T>(name)
        const newData = updateFn(prevData)
        await this.writeJsonToDataVolume(name, newData)
    }

    async existsInDataVolume(name: string): Promise<boolean> {
        const tryAccess = await fsPromises
            .access(join(envConfig().volume.data.path, this.safeFileName(name)))
            .then(() => true)
            .catch(() => false)
        return tryAccess
    }

    async isExpiredInDataVolume(name: string): Promise<boolean> {
        try {
            const fileContent = await this.readJsonFromDataVolume<FileContent>(name)
            return dayjs(fileContent.timeout).isBefore(dayjs())
        } catch {
            // when not found, we can treated as true
            return true
        }
    }

    async tryActionOrFallbackToVolume<T>({
        action,
        name,
    }: TryActionOrFallbackToVolumeParams<T>): Promise<T> {
        try {
            // check if the file exists
            const isExpired = await this.isExpiredInDataVolume(name)
            if (!isExpired) {
                const result = await this.readJsonFromDataVolume<T>(name)
                return result
            }
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
  action: () => Promise<T>;
  name: string;
}
