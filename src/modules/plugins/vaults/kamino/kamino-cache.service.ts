import {
    getMedianSlotDurationInMsFromLastEpochs,
    KaminoVaultClient,
    VaultStateJSON,
} from "@kamino-finance/klend-sdk"
import { Inject, Injectable, OnModuleInit } from "@nestjs/common"
import { ChainKey, Network } from "@/modules/common"
import {
    Address,
    createDefaultRpcTransport,
    createRpc,
    createSolanaRpcApi,
    DEFAULT_RPC_CONFIG,
    SolanaRpcApi,
} from "@solana/kit"
import { Connection } from "@solana/web3.js"
import { createProviderToken, RecordRpcProvider } from "@/modules/blockchain"
import { VolumeService } from "@/modules/volume"
import {
    KaminoApiService,
    VaultMetrics,
    VaultMetricsHistoryItem,
} from "./kamino-api.service"
import { Cron, CronExpression, Interval } from "@nestjs/schedule"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Cache } from "cache-manager"
import { createCacheKey } from "@/modules/cache"
import dayjs from "dayjs"
import { Logger } from "@nestjs/common"
import { getMetadata } from "@metaplex-foundation/mpl-token-metadata"

export interface VaultCache {
  state: VaultStateJSON | undefined;
  address: Address | undefined;
}
export interface Vault {
  // address of the vault
  address: string;
  // metrics of the vault, about the apr, etc
  metrics: VaultMetrics;
  // state of the vault, about the vault address, etc
  state: VaultStateJSON | undefined;
  // metrics history of the vault, about the apr, etc
  metricsHistory: Array<VaultMetricsHistoryItem>;
}

@Injectable()
export class KaminoVaultCacheService implements OnModuleInit {
    private kaminoVaultClients: Record<Network, KaminoVaultClient>
    private logger = new Logger(KaminoVaultCacheService.name)
    private vaults: Record<Network, Array<VaultCache>> = {
        [Network.Mainnet]: [],
        [Network.Testnet]: [],
    }
    private currentIndex: Record<Network, number> = {
        [Network.Mainnet]: 0,
        [Network.Testnet]: 0,
    }
    public initializedIndexes: Record<Network, Record<number, boolean>> = {
        [Network.Mainnet]: {},
        [Network.Testnet]: {},
    }
    constructor(
    private readonly volumeService: VolumeService,
    @Inject(createProviderToken(ChainKey.Solana))
    private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    private readonly kaminoApiService: KaminoApiService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    ) {}

    // fetch api each 0.5s to ensure the api call not bri

  @Interval(1000)
    async cacheVault() {
        for (const network of Object.values(Network)) {
            if (network === Network.Testnet) continue
            if (!this.vaults[network]?.length) continue

            if (!this.kaminoVaultClients?.[network]) {
                this.logger.warn(`KaminoVaultClient not initialized for ${network}`)
                continue
            }

            const currentIdx = this.currentIndex[network]

            // Nếu đã chạy hết danh sách vault thì skip không fetch nữa
            if (currentIdx >= this.vaults[network].length) {
                this.logger.debug(
                    `Reached end of vault list for ${network}, stopping fetch.`,
                )
                continue
            }

            const vaultToLoad = this.vaults[network][currentIdx]
            if (!vaultToLoad?.address) {
                this.logger.error(
                    `Vault address missing for index ${currentIdx} (${network})`,
                )
                this.nextIndex(network) // hoặc có thể không next nếu muốn dừng luôn khi lỗi
                continue
            }

            const vaultVolumeName = `kamino-vault-${network}-${vaultToLoad.address}.json`
            const vaultCacheKey = this.getVaultCacheKey(network, vaultToLoad.address)

            try {
                // Fetch metrics from API
                const metrics = await this.kaminoApiService.getVaultMetrics({
                    vaultPubkey: vaultToLoad.address.toString(),
                })
                // Fetch metrics history from API (1 year)
                const metricsHistory =
          await this.kaminoApiService.getVaultMetricsHistory({
              vaultPubkey: vaultToLoad.address.toString(),
              startDate: dayjs().subtract(1, "year").toISOString(),
              endDate: dayjs().toISOString(),
          })
                // Onchain shareMint token spl metadata
                const metadata = 

                const vault: Vault = {
                    address: vaultToLoad.address.toString(),
                    metrics,
                    state: vaultToLoad.state,
                    metricsHistory,
                }

                await Promise.all([
                    this.cacheManager.set(vaultCacheKey, vault),
                    this.volumeService.writeJsonToDataVolume<Vault>(
                        vaultVolumeName,
                        vault,
                    ),
                ])

                this.logger.debug(
                    `Updated vault ${vaultToLoad.address} (${network}) from API`,
                )
            } catch (error) {
                this.logger.error(
                    `Failed to fetch metrics for vault ${vaultToLoad.address} (${network}):`,
                    error,
                )

                // Fallback: recover from cached volume nếu cache trống
                try {
                    const existing = await this.cacheManager.get(vaultCacheKey)
                    if (!existing) {
                        const vault =
              await this.volumeService.readJsonFromDataVolume<Vault>(
                  vaultVolumeName,
              )
                        if (vault) {
                            await this.cacheManager.set(vaultCacheKey, vault)
                            this.logger.warn(
                                `Recovered vault ${vaultToLoad.address} from volume (${network})`,
                            )
                        } else {
                            throw new Error("Vault not found in volume")
                        }
                    }
                } catch (volumeError) {
                    this.logger.error(
                        `Failed to recover vault ${vaultToLoad.address} from volume (${network}):`,
                        volumeError,
                    )
                }
            }

            // Next index
            this.nextIndex(network)
        }
    }

  private nextIndex(network: Network) {
      if (this.currentIndex[network] < this.vaults[network].length) {
          this.currentIndex[network] = this.currentIndex[network] + 1
          this.initializedIndexes[network][this.currentIndex[network]] = true
      }
  }

  public getVaultsCacheKey(network: Network) {
      return createCacheKey("kamino-vaults", {
          network,
      })
  }

  public getVaultCacheKey(network: Network, vaultAddress: Address) {
      return createCacheKey("kamino-vault", {
          vaultAddress,
          network,
      })
  }

  private isUpdatingVaults = false

  @Cron(CronExpression.EVERY_HOUR)
  async cacheVaults() {
      // Prevent concurrent vault updates
      if (this.isUpdatingVaults) return
      this.isUpdatingVaults = true
      try {
          for (const network of Object.values(Network)) {
              if (network === Network.Testnet) continue
              if (!this.kaminoVaultClients?.[network]) {
                  this.logger.warn(`KaminoVaultClient not initialized for ${network}`)
                  continue
              }

              const volumeKey = `kamino-vaults-${network}.json`
              try {
                  const vaultsRaw = await this.kaminoVaultClients[network].getVaults()
                  const vaults: Array<VaultCache> = vaultsRaw.map((vaultRaw) => ({
                      state: vaultRaw?.state?.toJSON(),
                      address: vaultRaw?.address,
                  }))

                  await Promise.all([
                      this.volumeService.writeJsonToDataVolume(volumeKey, vaults),
                      this.cacheManager.set(this.getVaultsCacheKey(network), vaults),
                  ])

                  this.vaults[network] = vaults
                  this.currentIndex[network] = 0
                  this.initializedIndexes[network] = {} // Reset initialized indexes
              } catch (error) {
                  this.logger.error(
                      `Failed to fetch vaults for ${network}, loading from volume:`,
                      error,
                  )

                  try {
                      const vaults =
              await this.volumeService.readJsonFromDataVolume(volumeKey)
                      if (Array.isArray(vaults)) {
                          this.vaults[network] = vaults as Array<VaultCache>
                          this.currentIndex[network] = 0
                          this.initializedIndexes[network] = {}
                          await this.cacheManager.set(
                              this.getVaultsCacheKey(network),
                              vaults,
                          )
                          this.logger.log(
                              `Loaded ${vaults.length} vaults for ${network} from volume.`,
                          )
                      }
                  } catch (volumeError) {
                      this.logger.error(
                          `Failed to load vaults for ${network} from volume:`,
                          volumeError,
                      )
                  }
              }
          }
      } finally {
          this.isUpdatingVaults = false
      }
  }

  async onModuleInit() {
      try {
          const _kaminoVaultClients: Partial<Record<Network, KaminoVaultClient>> =
        {}
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
              _kaminoVaultClients[network] = new KaminoVaultClient(
                  createRpc({
                      api,
                      transport: createDefaultRpcTransport({
                          url: this.solanaRpcProvider[network].rpcEndpoint,
                      }),
                  }),
                  slotDuration,
              )
          }
          this.kaminoVaultClients = _kaminoVaultClients as Record<
        Network,
        KaminoVaultClient
      >
      // cache the vaults at initial
          this.cacheVaults()
      } catch (error) {
          this.logger.error(error)
      }
  }
}
