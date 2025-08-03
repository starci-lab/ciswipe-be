import { Injectable } from "@nestjs/common"
import { HttpService } from "@nestjs/axios"
import { lastValueFrom } from "rxjs"

export interface JitoDataPoint {
    data: number
    date: string
  }
  
export interface JitoStakePoolStats {
    aggregatedMevRewards: number
    apy: Array<JitoDataPoint>
    mevRewards:  Array<JitoDataPoint>
    numValidators:  Array<JitoDataPoint>
    supply:  Array<JitoDataPoint>
    tvl:  Array<JitoDataPoint>
}
  
export interface JitoPoolStats {
    getStakePoolStats: JitoStakePoolStats
  }
export interface ValidatorReward {
  vote_account: string
  mev_revenue: number
  mev_commission: number
  num_stakers: number
  epoch: number
}

export interface StakerReward {
  claimant: string
  stake_authority: string
  validator_vote_account: string
  epoch: number
  amount: number
}

export interface ValidatorEpochStats {
  vote_account: string
  mev_rewards: number
  active_stake: number
  mev_commission_bps: number
  running_jito: boolean
  epoch: number
}

export interface NetworkMev {
  epoch: number
  total_network_mev_lamports: number
  jito_stake_weight_lamports: number
  mev_reward_per_lamport: number
}

export interface JitoStakeRatio {
  [epoch: number]: number
}

export interface DailyMev {
  date: string
  jito_tips: number
  tippers: number
  count_mev_tips: number
  validator_tips: number
}

@Injectable()
export class JitoSdkService {
    private readonly BASE_URL = "https://www.jito.network/api"

    constructor(private readonly httpService: HttpService) {}

    private async getWithFetch<TResponse, TParams = object>(
        path: string,
        params?: TParams,
    ): Promise<TResponse> {
        try {
            const url = new URL(`${this.BASE_URL}${path}`)
            if (params) {
                Object.entries(params).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        url.searchParams.append(key, String(value))
                    }
                })
            }
            const response = await fetch(url.toString(), {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            })
      
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`)
            }
      
            return (await response.json()) as TResponse
        } catch (error) {
            throw new Error(`GET ${path} failed: ${error.message}`)
        }
    }

    private async post<TResponse, TBody = object>(path: string, body?: TBody): Promise<TResponse> {
        try {
            const response = await lastValueFrom(
                this.httpService.post(`${this.BASE_URL}${path}`, body),
            )
            return response.data
        } catch (error) {
            throw new Error(`POST ${path} failed: ${error.message}`)
        }
    }

    /** Pool stats (undocumented endpoint) */
    async getPoolStats(): Promise<JitoPoolStats> {
        return this.getWithFetch<JitoPoolStats>("/getJitoPoolStats")
    }

    /** MEV rewards by validator */
    async getValidatorRewards(params?: {
    vote_account?: string
    epoch?: number
    page?: number
    limit?: number
    sort_order?: "asc" | "desc"
  }): Promise<Array<ValidatorReward>> {
        return this.getWithFetch<Array<ValidatorReward>, {
            vote_account?: string
            epoch?: number
            page?: number
            limit?: number
            sort_order?: "asc" | "desc"
        }>("/v1/validator_rewards", params)
    }

    /** Staker rewards */
    async getStakerRewards(params?: {
    stake_authority?: string
    validator_vote_account?: string
    epoch?: number
    page?: number
    limit?: number
    sort_order?: "asc" | "desc"
  }): Promise<Array<StakerReward>> {
        return this.getWithFetch<Array<StakerReward>>("/v1/staker_rewards", params)
    }

    /** Validator stats by epoch */
    async getValidatorsByEpoch(epoch: number): Promise<Array<ValidatorEpochStats>> {
        return this.getWithFetch<Array<ValidatorEpochStats>, { epoch: number }>("/v1/validators", { epoch })
    }

    /** Validator historical stats */
    async getValidatorHistory(voteAccount: string): Promise<Array<ValidatorEpochStats>> {
        return this.getWithFetch<Array<ValidatorEpochStats>, { vote_account: string }>(`/v1/validators/${voteAccount}`)
    }

    /** Network MEV per epoch */
    async getNetworkMev(epoch: number): Promise<NetworkMev> {
        return this.post<NetworkMev, { epoch: number }>("/v1/mev_rewards", { epoch })
    }

    /** Jito stake ratio over time */
    async getStakeRatioOverTime(): Promise<JitoStakeRatio> {
        return this.getWithFetch<JitoStakeRatio>("/v1/jito_stake_over_time")
    }

    /** Daily MEV stats */
    async getDailyMev(): Promise<Array<DailyMev>> {
        return this.getWithFetch<Array<DailyMev>>("/v1/daily_mev_rewards")
    }
}
