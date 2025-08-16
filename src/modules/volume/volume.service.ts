import { Injectable, OnModuleInit } from "@nestjs/common"
import * as fsPromises from "fs/promises"
import { envConfig } from "../env"
import { join } from "path"
import dayjs from "dayjs"

export interface FileContent<T = unknown> {
    data: T;
    timeout: string;
}

export interface TryActionOrFallbackToVolumeParams<T> {
    action: () => Promise<T>;
    name: string;
    folderNames?: Array<string>;
}

export interface UpdateJsonFromDataVolumeParams<T> {
    name: string;
    updateFn: (prevData: T) => T;
    folderNames?: Array<string>;
}

export interface ReadJsonFromDataVolumeParams {
    name: string;
    folderNames?: Array<string>;
}

export interface ExistsInDataVolumeParams {
    name: string;
    folderNames?: Array<string>;
}

export interface IsExpiredInDataVolumeParams {
    name: string;
    folderNames?: Array<string>;
}

export interface WriteJsonToDataVolumeParams<T> {
    name: string;
    data: T;
    folderNames?: Array<string>;
    timeout?: number;
}

@Injectable()
export class VolumeService implements OnModuleInit {
    constructor() { }

    onModuleInit() {
        // mkdir if not exists (root path)
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
        folderNames: Array<string> = [],
        timeout = 1000 * 60 * 60 * 24 * 365 // 1 year
    ) {
        const fileContent: FileContent<T> = {
            data,
            timeout: dayjs().add(timeout, "ms").toISOString(),
        }

        const fullPath = join(envConfig().volume.data.path, ...folderNames)

        // Create nested folder if not exists
        await fsPromises.mkdir(fullPath, { recursive: true })

        // Write JSON file
        await fsPromises.writeFile(
            join(fullPath, this.safeFileName(name)),
            JSON.stringify(fileContent, null, 2)
        )
    }

    async readJsonFromDataVolume<T>(
        { name, folderNames }: ReadJsonFromDataVolumeParams
    ): Promise<T> {
        const filePath = join(
            envConfig().volume.data.path,
            ...folderNames || [],
            this.safeFileName(name)
        )
        const raw = await fsPromises.readFile(filePath, "utf-8")
        const fileContent = JSON.parse(raw) as FileContent<T>
        return fileContent.data
    }

    async updateJsonFromDataVolume<T>(
        { name, updateFn, folderNames }: UpdateJsonFromDataVolumeParams<T>
    ): Promise<void> {
        const prevData = await this.readJsonFromDataVolume<T>({
            name,
            folderNames
        })
        const newData = updateFn(prevData)
        await this.writeJsonToDataVolume(name, newData, folderNames)
    }

    async existsInDataVolume(
        { name, folderNames }: ExistsInDataVolumeParams
    ): Promise<boolean> {
        const filePath = join(
            envConfig().volume.data.path,
            ...folderNames || [],
            this.safeFileName(name)
        )
        return fsPromises
            .access(filePath)
            .then(() => true)
            .catch(() => false)
    }

    async isExpiredInDataVolume(
        {
            name,
            folderNames
        }: IsExpiredInDataVolumeParams
    ): Promise<boolean> {
        try {
            const fileContent = await this.readJsonFromDataVolume<FileContent>(
                { name, folderNames }
            )
            return dayjs(fileContent.timeout).isBefore(dayjs())
        } catch {
            // when not found, treat as expired
            return true
        }
    }

    async tryActionOrFallbackToVolume<T>({
        action,
        name,
        folderNames = [],
    }: TryActionOrFallbackToVolumeParams<T>): Promise<T> {
        try {
            const isExpired = await this.isExpiredInDataVolume({ name, folderNames })
            if (!isExpired) {
                return await this.readJsonFromDataVolume<T>({ name, folderNames })
            }

            const result = await action()
            await this.writeJsonToDataVolume(name, result, folderNames)
            return result
        } catch (error) {
            try {
                return await this.readJsonFromDataVolume<T>({ name, folderNames })
            } catch {
                throw error
            }
        }
    }
}