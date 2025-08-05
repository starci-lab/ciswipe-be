import {
    createProviderToken,
    RecordRpcProvider,
} from "@/modules/blockchain"
import {
    ExecuteParams,
    ExecuteResult,
    ExecuteStrategy,
    GetDataParams,
    LendingOutputStrategyType,
} from "../abstract"
import {
    Inject,
    Injectable,
    OnModuleInit,
} from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
import { VolumeService } from "@/modules/volume"
import { LendingPluginAbstract } from "../abstract"
import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoMarket,
} from "@kamino-finance/klend-sdk"
import {
    DEFAULT_RPC_CONFIG,
    createSolanaRpcApi,
    SolanaRpcApi,
    createRpc,
    createDefaultRpcTransport,
    address,
    Address,
} from "@solana/kit"
import { createCacheKey } from "@/modules/cache"
import { ChainKey, computePercentage, Network, TokenType } from "@/modules/common"
import { tokens } from "@/modules/blockchain"

// market pubkeys
const marketPubkeys = {
    [Network.Mainnet]: [address("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF")],
    [Network.Testnet]: [address("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF")],
}

export interface KaminoLendVault {
  id: string;
  collateralMint: string;
  collateralExchangeRate: number;
  apr: number;
  mint: string;
}

export interface GetGlobalDataParams {
  network: Network;
  chainKey: ChainKey;
}

@Injectable()
export class KaminoPluginService
    extends LendingPluginAbstract
    implements OnModuleInit
{
    private kaminoMarketMaps: Record<Network, Map<Address, KaminoMarket>>
    constructor(
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly volumeService: VolumeService,
    ) {
        super({
            name: "Kamino",
            icon: "https://kamino.finance/favicon.ico",
            url: "https://kamino.finance",
            description: "Kamino is a decentralized exchange on Solana.",
            tags: ["lending"],
            chainKeys: [ChainKey.Solana],
        })
    }

    protected async getData(params: GetDataParams): Promise<unknown> {
        let token = tokens[params.chainKey][params.network].find(
            (token) => token.id === params.inputToken.id,
        )
        if (!token) {
            throw new Error("Token not found")
        }
        if (token.type === TokenType.Native) {
            token = tokens[params.chainKey][params.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!token) {
                throw new Error("Wrapper token not found")
            }
        }
        const vaults = await this.getGlobalData(params)
        return vaults.filter((vault) => vault.mint === token.tokenAddress)
    }

    protected async getGlobalData(
        params: GetGlobalDataParams,
    ): Promise<Array<KaminoLendVault>> {
        const volumeName = "kamino.json"
        try {
            const slot = await this.solanaRpcProvider[params.network].getSlot()
            const markets = Array.from(
                this.kaminoMarketMaps[params.network].values(),
            )
            const vaults: Array<KaminoLendVault> = []
            for (const market of markets) {
                const reserves = market.getReserves()
                for (const reserve of reserves) {
                    vaults.push({
                        id: reserve.address,
                        collateralMint: reserve.getCTokenMint(),
                        collateralExchangeRate: reserve
                            .getEstimatedCollateralExchangeRate(BigInt(slot), 0)
                            .toNumber(),
                        apr: reserve.calculateSupplyAPR(BigInt(slot), 0),
                        mint: reserve.getLiquidityMint(),
                    })
                }
            }
            await this.volumeService.writeJsonToDataVolume<Array<KaminoLendVault>>(
                volumeName,
                vaults,
            )
            return vaults
        } catch (error) {
            console.error(error)
            // if error happlen, we try to read from volume
            try {
                return await this.volumeService.readJsonFromDataVolume<
          Array<KaminoLendVault>
        >(volumeName)
            } catch (error) {
                console.error(error)
            }
            throw error
        }
    }

    async onModuleInit() {
        const _kaminoMarketMaps: Partial<
      Record<Network, Map<Address, KaminoMarket>>
    > = {}
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) {
                // do nothing for testnet
                continue
            }
            const slotDuration = await getMedianSlotDurationInMsFromLastEpochs()
            const api = createSolanaRpcApi<SolanaRpcApi>({
                ...DEFAULT_RPC_CONFIG,
                defaultCommitment: "confirmed",
            })
            _kaminoMarketMaps[network] = await KaminoMarket.loadMultiple(
                createRpc({
                    api,
                    transport: createDefaultRpcTransport({
                        url: this.solanaRpcProvider[network].rpcEndpoint,
                    }),
                }),
                marketPubkeys[network],
                slotDuration,
            )
        }
        this.kaminoMarketMaps = _kaminoMarketMaps as Record<
      Network,
      Map<Address, KaminoMarket>
    >
    }

    // method to add liquidity to a pool
    protected async execute(params: ExecuteParams): Promise<ExecuteResult> {
        let token = tokens[params.chainKey][params.network].find(
            (token) => token.id === params.inputToken.id,
        )
        if (!token) {
            throw new Error("Token not found")
        }
        if (token.type === TokenType.Native) {
            token = tokens[params.chainKey][params.network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (!token) {
                throw new Error("Wrapper token not found")
            }
        }
        // load from cache
        const cacheKey = createCacheKey("Kamino", params)
        const cachedData = await this.cacheManager.get(cacheKey)
        if (cachedData) {
            return cachedData as ExecuteResult
        }
        const vaults = await this.getData({
            network: params.network,
            chainKey: params.chainKey,
            inputToken: token,
        })
        const result: ExecuteResult = {
            strategies: [],
        }
        const promises = Array<Promise<void>>()
        for (const vault of vaults as Array<KaminoLendVault>) {
            promises.push(
                (async () => {
                    const apy = vault.apr
                    const strategy: ExecuteStrategy = {
                        outputTokens: [
                            {
                                tokenAddress: vault.collateralMint,
                                amount: vault.collateralExchangeRate,
                            },
                        ],
                        apr: {
                            apr: computePercentage(apy, 1, 5),
                        },
                        type: LendingOutputStrategyType.Lending,
                        metadata: {
                            vaultId: vault.id,
                        },
                    }
                    result.strategies.push(strategy)
                })(),
            )
        }
        await Promise.all(promises)
        await this.cacheManager.set<ExecuteResult>(cacheKey, result)
        return result
    }
}
