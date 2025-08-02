export interface PluginMetadata {
    // plugin unique identifier
    id: string
    // plugin name
    name: string
    // plugin description
    description: string
    // plugin website
    website: string
    // plugin icon
    icon: string
}

export interface PluginAction {
    inputTokens: Array<string>
}