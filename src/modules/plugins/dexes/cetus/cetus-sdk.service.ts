import { Injectable } from "@nestjs/common"
import { Network } from "@/modules/blockchain"
import { HttpService } from "@nestjs/axios"
import { lastValueFrom } from "rxjs"

export interface CoinInfo {
  coinType: string;
  symbol: string;
  decimals: number;
  isVerified: boolean;
  logoURL: string;
}

export interface PoolStats {
  dateType: string;
  vol: string;
  fee: string;
  apr: string;
}

export interface MiningRewarder {
  coinType: string;
  symbol: string;
  decimals: number;
  logoURL: string;
  display: boolean;
  apr: string;
  emissionsPerSecond?: string;
}

interface PoolExtensions {
  pool_tag?: string;
  frozen?: string;
  mining_display?: boolean;
  mining_rewarders_display?: Array<boolean>;
  zap?: string;
}

interface VaultInfo {
  id: string;
  category: string;
}

export interface PoolData {
  pool: string;
  feeRate: number;
  showReverse: boolean;
  coinA: CoinInfo;
  coinB: CoinInfo;
  tvl: string;
  totalApr: string;
  stats: Array<PoolStats>;
  miningRewarders?: Array<MiningRewarder>;
  extensions?: PoolExtensions;
  vault?: VaultInfo;
}

export interface CetusApiResponse {
  total?: number;
  list?: Array<PoolData>;
}

export interface PoolQueryBody {
  filter?: "verified" | "unverified" | "all";
  sortBy?: "vol" | "tvl" | "apr" | "fee";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  coinTypes?: Array<string>;
  pools?: Array<string>
}

@Injectable()
export class CetusSdkService {
    private readonly MAINNET_API =
        "https://api-sui.cetus.zone/v3/sui/clmm/stats_pools"

    constructor(private readonly httpService: HttpService) {}

    private async query(
        url: string,
        body: PoolQueryBody,
    ): Promise<CetusApiResponse> {
        try {
            const response = await lastValueFrom(this.httpService.post(url, body, {
                headers: {
                    "Content-Type": "application/json",
                },
            }))
            console.log(response.data)
            return response.data?.data || response.data
        } catch (error) {
            throw new Error(`Failed to fetch from Cetus API: ${error.message}`)
        }
    }

    async getPools(
        body: PoolQueryBody = {},
        network: Network = Network.Mainnet,
    ): Promise<CetusApiResponse> {
        if (network !== Network.Mainnet) {
            return {
                total: 0,
                list: Array<PoolData>(),
            }
        }
        return this.query(this.MAINNET_API, body)
    }

    // Existing methods updated to use makeRequest
    async getPoolByAddress(poolAddress: string): Promise<PoolData | null> {
        const { list } = await this.getPools({
            pools: [poolAddress],
        })
        return list?.find((pool) => pool.pool === poolAddress) || null
    }

    async getTopPoolsByTVL(limit: number = 10): Promise<Array<PoolData>> {
        const { list } = await this.getPools({
            sortBy: "tvl",
            sortOrder: "desc",
            limit,
        })
        return list || Array<PoolData>()
    }

    async getPoolsByAddresses(
        poolAddresses: Array<string>,
    ): Promise<Array<PoolData>> {
        const response = await this.getPools({
            pools: poolAddresses,
        })
        return response.list || []
    }

    // Other existing methods remain the same...
    async getVerifiedPools(): Promise<Array<PoolData>> {
        const { list } = await this.getPools({
            filter: "verified",
        })
        return list || Array<PoolData>()
    }

    async getPoolsByTokens(
        tokenAddresses: Array<string>,
    ): Promise<Array<PoolData>> {
        const { list } = await this.getPools({
            coinTypes: tokenAddresses,
        })
        return list || Array<PoolData>()
    }

    async getHighVolumePools(limit: number = 10): Promise<Array<PoolData>> {
        const { list } = await this.getPools({
            sortBy: "vol",
            sortOrder: "desc",
            limit,
        })
        return list || Array<PoolData>()
    }

    async getPoolsPaginated(
        page: number = 1,
        pageSize: number = 20,
    ): Promise<{
    pools?: Array<PoolData>;
    total: number;
    page: number;
    pageSize: number;
  }> {
        const offset = (page - 1) * pageSize
        const { list, total } = await this.getPools({
            limit: pageSize,
            offset,
        })

        return {
            pools: list || [],
            total: total || 0,
            page,
            pageSize,
        }
    }
}
