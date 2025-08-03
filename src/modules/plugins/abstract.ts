import { ChainKey } from "@/modules/blockchain"

export interface BasePluginAbstractConstructorParams {
    name: string
    icon: string
    url: string
    description: string
    tags: Array<string>
    chainKeys: Array<ChainKey>
    kind: PluginKind
}

export enum PluginKind {
    Dex = "dex",
    Lending = "lending",
    Staking = "staking",
}

// base plugin class, contains common properties for all plugins
export abstract class BasePluginAbstract {
    private readonly name: string
    private readonly icon: string
    private readonly url: string
    private readonly description: string
    private readonly tags: Array<string>
    private readonly chainKeys: Array<ChainKey>
    private readonly kind: PluginKind

    constructor(
        {
            name,
            icon,
            url,
            description,
            tags,
            chainKeys,
            kind
        }: BasePluginAbstractConstructorParams
    ) {
        this.name = name
        this.icon = icon
        this.url = url
        this.description = description
        this.tags = tags
        this.chainKeys = chainKeys
        this.kind = kind
    }
}