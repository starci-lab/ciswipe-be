import { Injectable, OnModuleInit } from "@nestjs/common"
import { NextJsQueryService } from "@/modules/misc"

export interface JitoDataPoint {
  data: number;
  date: string;
}

export interface JitoStakePoolStats {
  aggregatedMevRewards: number;
  apy: Array<JitoDataPoint>;
  mevRewards: Array<JitoDataPoint>;
  numValidators: Array<JitoDataPoint>;
  supply: Array<JitoDataPoint>;
  tvl: Array<JitoDataPoint>;
}

export interface JitoPoolStats {
  getStakePoolStats: JitoStakePoolStats;
}

export interface ValidatorReward {
  vote_account: string;
  mev_revenue: number;
  mev_commission: number;
  num_stakers: number;
  epoch: number;
}

export interface StakerReward {
  claimant: string;
  stake_authority: string;
  validator_vote_account: string;
  epoch: number;
  amount: number;
}

export interface ValidatorEpochStats {
  vote_account: string;
  mev_rewards: number;
  active_stake: number;
  mev_commission_bps: number;
  running_jito: boolean;
  epoch: number;
}

export interface NetworkMev {
  epoch: number;
  total_network_mev_lamports: number;
  jito_stake_weight_lamports: number;
  mev_reward_per_lamport: number;
}

export interface JitoStakeRatio {
  [epoch: number]: number;
}

export interface DailyMev {
  date: string;
  jito_tips: number;
  tippers: number;
  count_mev_tips: number;
  validator_tips: number;
}

@Injectable()
export class JitoStakingApiService implements OnModuleInit {
    private readonly BASE_URL = "https://www.jito.network"

    constructor(private readonly nextJsQueryService: NextJsQueryService) {}

    async onModuleInit() {
        await this.nextJsQueryService.addPage(this.BASE_URL)
    }

    /** Pool stats (undocumented endpoint) */
    async getPoolStats(): Promise<JitoPoolStats> {
        const response = await this.nextJsQueryService.get<JitoPoolStats>(
            `${this.BASE_URL}`,
            "/api/getJitoPoolStats",
            {},
        )
        return response
    }

    /** MEV rewards by validator */
    async getValidatorRewards(params?: {
    vote_account?: string;
    epoch?: number;
    page?: number;
    limit?: number;
    sort_order?: "asc" | "desc";
  }): Promise<Array<ValidatorReward>> {
        const response = await this.nextJsQueryService.get<
      Array<ValidatorReward>  
    >(`${this.BASE_URL}`, "/api/validator_rewards", params)
        return response
    }

    /** Staker rewards */
    async getStakerRewards(
        params?: {
    stake_authority?: string;
    validator_vote_account?: string;
    epoch?: number;
    page?: number;
    limit?: number;
    sort_order?: "asc" | "desc";
  }): Promise<Array<StakerReward>> {
        const response = await this.nextJsQueryService.get<Array<StakerReward>>(
            `${this.BASE_URL}`,
            "/api/staker_rewards",
            params,
        )
        return response
    }

    /** Validator stats by epoch */
    async getValidatorsByEpoch(
        epoch: number,
    ): Promise<Array<ValidatorEpochStats>> {
        const response = await this.nextJsQueryService.get<
      Array<ValidatorEpochStats>
    >(`${this.BASE_URL}`, "/api/validators", { epoch })
        return response
    }

    /** Validator historical stats */
    async getValidatorHistory(
        voteAccount: string,
    ): Promise<Array<ValidatorEpochStats>> {
        const response = await this.nextJsQueryService.get<
      Array<ValidatorEpochStats>
    >(`${this.BASE_URL}`, `/api/validators/${voteAccount}`)
        return response
    }

    /** Network MEV per epoch */
    async getNetworkMev(epoch: number): Promise<NetworkMev> {
        const response = await this.nextJsQueryService.get<NetworkMev>(
            `${this.BASE_URL}`,
            "/api/mev_rewards",
            { epoch },
        )
        return response
    }

    /** Jito stake ratio over time */
    async getStakeRatioOverTime(): Promise<JitoStakeRatio> {
        const response = await this.nextJsQueryService.get<JitoStakeRatio>(
            `${this.BASE_URL}`,
            "/api/jito_stake_over_time",
        )
        return response
    }

    /** Daily MEV stats */
    async getDailyMev(): Promise<Array<DailyMev>> {
        const response = await this.nextJsQueryService.get<Array<DailyMev>>(
            `${this.BASE_URL}`,
            "/api/daily_mev_rewards",
        )
        return response
    }
}
