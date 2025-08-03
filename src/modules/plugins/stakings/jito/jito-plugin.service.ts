import {
    ChainKey,
    createProviderToken,
    Network,
    TokenId,
} from "@/modules/blockchain"
import {
    StakingPluginAbstract,
    StakeOutputResult,
    StakeParams,
    GetDataParams,
} from "../abstract"
import {
    Inject,
    Injectable,
    OnApplicationBootstrap,
    OnModuleInit,
} from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { VolumeService } from "@/modules/volume"
import { JitoPoolStats, JitoSdkService } from "./jito-sdk.service"
import { JupiterQuoteService } from "../../aggregators"
import { computePercentage } from "@/modules/common"

export interface Data {
  stats: JitoPoolStats;
}

@Injectable()
export class JitoPluginService
    extends StakingPluginAbstract
    implements OnModuleInit, OnApplicationBootstrap
{
    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: Record<Network, Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly volumeService: VolumeService,
    private readonly jitoSdkService: JitoSdkService,
    private readonly jupiterQuoteService: JupiterQuoteService,
    ) {
        super({
            name: "Jito",
            icon: "https://jito.io/favicon.ico",
            url: "https://jito.io",
            description: "Jito is a staking platform on Solana.",
            tags: ["staking"],
            chainKeys: [ChainKey.Solana],
        })
    }

    /** Load Jito SDK per-network */
    async onModuleInit() {}

    async onApplicationBootstrap() {
    // Example: stake SOL to Jito pool and log result
        const result = await this.stake({
            network: Network.Mainnet,
            chainKey: ChainKey.Solana,
            inputToken: { id: TokenId.SolanaSolMainnet, amount: 1 },
        })
        console.dir(result, { depth: null })
    }

    protected async getData({ ...coreParams }: GetDataParams): Promise<Data> {
        const volumeName = `jito-${coreParams.inputToken.id}.json`
        try {
            const stats = await this.jitoSdkService.getPoolStats()
            await this.volumeService.writeJsonToDataVolume<JitoPoolStats>(
                volumeName,
                stats,
            )
            return { stats }
        } catch (error) {
            console.error(error)
            try {
                const stats =
          await this.volumeService.readJsonFromDataVolume<JitoPoolStats>(
              volumeName,
          )
                return { stats }
            } catch (error) {
                console.error(error)
            }
            throw error
        }
    }

    /** Stake into Jito */
    protected async stake({
        ...coreParams
    }: StakeParams): Promise<StakeOutputResult> {
        try {
            const { stats } = await this.getData({ ...coreParams })
            if (!coreParams.inputToken.amount) {
                throw new Error("Input token amount is required")
            }
            const { amountOut } = await this.jupiterQuoteService.quote({
                tokenInId: TokenId.SolanaSolMainnet,
                tokenOutId: TokenId.SolanaJitoSolMainnet,
                amount: coreParams.inputToken.amount,
            })
            return {
                outputTokens: [
                    {
                        id: TokenId.SolanaJupMainnet,
                        amount: amountOut,
                    }
                ],
                apy: {
                    apy: computePercentage(stats.getStakePoolStats.apy.at(-1)?.data ?? 0, 1, 5)
                },
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }
}
