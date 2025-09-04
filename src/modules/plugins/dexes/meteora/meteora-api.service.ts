import { HttpService } from "@nestjs/axios"
import { Injectable, InternalServerErrorException } from "@nestjs/common"
import axiosRetry from "axios-retry"
import { lastValueFrom } from "rxjs"

// Whirlpool basic structure returned by Orca API
export interface OrcaWhirlpool {
  address: string
  liquidity: string
  feeRate: number
  price: string
  tvlUsdc: string
  tokenA: {
    address: string
    symbol: string
    name: string
    decimals: number
    imageUrl?: string
  }
  tokenB: {
    address: string
    symbol: string
    name: string
    decimals: number
    imageUrl?: string
  }

  // Optional extras commonly present in /pools response
  adaptiveFeeEnabled?: boolean
  feeTierIndex?: number
  hasWarning?: boolean
  poolType?: string
  lockedLiquidityPercent?: Array<{ lockedPercentage: string; name: string }>
  rewards?: Array<{
    authority: string
    emissions_per_second_x64: string
    growth_global_x64: string
    mint: string
    vault: string
    active: boolean
    emissionsPerSecond: string
  }>
  stats?: Record<string, {
    fees: string
    rewards: string
    volume: string
    yieldOverTvl: string
  }>
}

// API response for searchWhirlpools
interface OrcaSearchResponse {
  data: Array<OrcaWhirlpool>
  meta: {
    next?: string | null
    previous?: string | null
  }
}

// Request parameters for searchWhirlpools
export interface SearchWhirlpoolsParams {
  q?: string                       // Token symbols or pool address
  next?: string                    // Cursor for pagination (next page)
  size?: number                    // Number of results to return
  sortBy?: string                  // Field to sort by (e.g. volume, tvlUsdc)
  sortDirection?: "asc" | "desc"   // Sort order
  minTvl?: number                  // Minimum TVL in USDC
  minVolume?: number               // Minimum trading volume in USDC
  stats?: Array<string>            // Time periods for stats (comma-serialized)
  userTokens?: Array<string>       // Token addresses owned by the user (comma-serialized)
  hasRewards?: boolean             // Filter pools with rewards
  verifiedOnly?: boolean           // Filter pools with verified tokens
  hasLockedLiquidity?: boolean     // Filter pools with locked liquidity
}

// ===== NEW: List whirlpools endpoint (/pools) =====

// Params for GET /pools (optional filtering + pagination)
export interface ListWhirlpoolsParams {
  sortBy?: string                   // Field to sort whirlpools by
  sortDirection?: "asc" | "desc"    // Direction to sort
  next?: string                     // Cursor to start the next page
  previous?: string                 // Cursor to start the previous page
  hasRewards?: boolean              // Must have rewards
  hasWarning?: boolean              // Must have a warning
  hasAdaptiveFee?: boolean          // Must be using adaptive fee
  isWavebreak?: boolean             // Must have graduated from wavebreak
  minTvl?: number                   // Minimum TVL in USDC
  minVolume?: number                // Minimum volume in USDC
  minLockedLiquidityPercent?: number// Minimum locked liquidity percentage
  size?: number                     // Number of results to return
  token?: string                    // Filter pools containing this token
  tokensBothOf?: Array<string>      // Filter pools containing both tokens (comma-serialized)
  addresses?: Array<string>         // Filter pools with these addresses (comma-serialized)
  stats?: Array<string>             // Time periods for stats (comma-serialized)
  includeBlocked?: boolean          // Include blocked whirlpools if true
}

// Response for GET /pools
export interface ListWhirlpoolsResponse {
  data: Array<OrcaWhirlpool>
  meta: {
    next?: string | null
    previous?: string | null
  }
}

@Injectable()
export class OrcaDexApiService {
    private readonly baseUrl = "https://api.orca.so/v2/solana"

    constructor(private readonly httpService: HttpService) {
        axiosRetry(this.httpService.axiosRef, { retries: 3 })
    }

    // Helper to serialize array params as comma-separated strings
    private serializeArrays(params: Record<string, unknown>, keys: Array<string>): Record<string, unknown> {
        const out: Record<string, unknown> = { ...params }
        for (const k of keys) {
            if (Array.isArray(out[k])) {
                out[k] = out[k].join(",")
            }
        }
        return out
    }

    async searchWhirlpools(
        params: SearchWhirlpoolsParams
    ): Promise<OrcaSearchResponse> {
        const url = `${this.baseUrl}/pools/search`

        // Ensure arrays are comma-separated as required by the API
        const fixed = this.serializeArrays(params as Record<string, unknown>, ["stats", "userTokens"])

        try {
            const response$ = this.httpService.get<OrcaSearchResponse>(url, { params: fixed })
            const response = await lastValueFrom(response$)
            return response.data
        } catch (error) {
            throw new InternalServerErrorException(error.message)
        }
    }

    // ===== NEW: listWhirlpools (GET /pools) =====
    async listWhirlpools(
        params: ListWhirlpoolsParams = {}
    ): Promise<ListWhirlpoolsResponse> {
        const url = `${this.baseUrl}/pools`

        // Serialize arrays as comma-separated lists per API expectation
        const fixed = this.serializeArrays(params as Record<string, unknown>, [
            "tokensBothOf",
            "addresses",
            "stats",
        ])
        // logging removed to follow structured logging style in services

        try {
            const response$ = this.httpService.get<ListWhirlpoolsResponse>(url, { params: fixed })
            const response = await lastValueFrom(response$)
            return response.data
        } catch (error) {
            throw new InternalServerErrorException(error.message)
        }
    }
}