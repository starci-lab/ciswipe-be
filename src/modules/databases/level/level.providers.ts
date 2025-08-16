import { Provider } from "@nestjs/common"
import { Network } from "@/modules/common"
import { Level } from "level"

export const LEVEL_PROVIDER_TOKEN = "level-provider"
export const getLevelProvider = (): Provider<Record<Network, Level>> => ({
    provide: LEVEL_PROVIDER_TOKEN,
    useFactory: (): Record<Network, Level> => {
        return {
            [Network.Mainnet]: new Level(
                ".db/mainnet", {
                    compression: true,
                    createIfMissing: true
                }
            ),
            [Network.Testnet]: new Level(
                ".db/testnet",
                {
                    compression: true,
                    createIfMissing: true
                }
            ),
        }
    }
})