import { Network } from "@/modules/common"
import { HttpService } from "@nestjs/axios"
import { Injectable } from "@nestjs/common"
import axiosRetry from "axios-retry"
import { firstValueFrom } from "rxjs"

/** ================= TYPE SOLEND API ================== */
export enum AssetType {
    Regular = 0,
    Isolated = 1,
}

export interface RateLimiter {
    config: {
        maxOutflow: string;
        windowDuration: string;
    };
    previousQuantity: string;
    windowStart: string;
    currentQuantity: string;
}

export interface ReserveLiquidity {
    mintPubkey: string;
    mintDecimals: number;
    supplyPubkey: string;
    oracleOption: string | null;
    pythOracle: string;
    switchboardOracle: string;
    availableAmount: string;
    borrowedAmountWads: string;
    cumulativeBorrowRateWads: string;
    accumulatedProtocolFeesWads: string;
    marketPrice: string;
    smoothedMarketPrice: string | null;
}

export interface ReserveCollateral {
    mintPubkey: string;
    mintTotalSupply: string;
    supplyPubkey: string;
}

export interface ReserveConfigFees {
    borrowFeeWad: string;
    flashLoanFeeWad: string;
    hostFeePercentage: number;
}

export interface ReserveConfig {
    optimalUtilizationRate: number;
    maxUtilizationRate: number;
    loanToValueRatio: number;
    liquidationBonus: number;
    maxLiquidationBonus: number;
    liquidationThreshold: number;
    maxLiquidationThreshold: number;
    minBorrowRate: number;
    optimalBorrowRate: number;
    maxBorrowRate: number;
    superMaxBorrowRate: string;
    fees: ReserveConfigFees;
    depositLimit: string;
    borrowLimit: string;
    feeReceiver: string;
    protocolLiquidationFee: number;
    protocolTakeRate: number;
    addedBorrowWeightBPS: string;
    borrowWeight: string;
    reserveType: AssetType;
    liquidityExtraMarketPriceFlag: number;
    liquidityExtraMarketPrice: string;
    attributedBorrowValue: string;
    scaledPriceOffsetBPS: string;
    extraOracle: string;
    attributedBorrowLimitOpen: string;
    attributedBorrowLimitClose: string;
}

export interface LastUpdate {
    slot: string;
    stale: number;
}

export interface Reserve {
    version: number;
    lastUpdate: LastUpdate;
    lendingMarket: string;
    liquidity: ReserveLiquidity;
    collateral: ReserveCollateral;
    config: ReserveConfig;
    rateLimiter: RateLimiter;
    pubkey: string;
    address: string;
}

export interface ReserveRates {
    supplyInterest: string;
    borrowInterest: string;
}

export interface ReserveReward {
    rewardMint: string;
    rewardSymbol: string;
    apy: string;
    side: "supply" | "borrow";
}

export interface ReserveResult {
    reserve: Reserve;
    cTokenExchangeRate: string;
    rates: ReserveRates;
    rewards: Array<ReserveReward>;
}

export interface ReservesResponse {
    results: Array<ReserveResult>;
}

/** ================= HISTORICAL ================== */
export interface HistoricalInterestRateItem {
    id?: number;
    reserveID: string;
    supplyAPY: number;
    borrowAPY: number;
    supplyAPR: number;
    borrowAPR: number;
    cTokenExchangeRate: string;
    timestamp: number; // unix timestamp
}

export interface HistoricalInterestRatesResponse {
    [reserveID: string]: Array<HistoricalInterestRateItem>;
}

/** ================= MARKET ================== */
export interface Market {
    address: string;
    name: string;
    description: string;
    isPrimary: boolean;
    creator: string;
}

export interface MarketsResponse {
    results: Array<Market>;
}

@Injectable()
export class SolendLendingApiService {
    private readonly baseUrl = "https://api.solend.fi"

    constructor(private readonly httpService: HttpService) {
        axiosRetry(this.httpService.axiosRef, {
            retries: 3,
            retryDelay: (retryCount) => retryCount * 1000,
            retryCondition: (error) =>
                axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                (error.response?.status ?? 0) >= 500,
        })
    }

    async getReserves(
        network: Network,
        scope: "all" | "permissionless" | "solend" = "all"
    ): Promise<ReservesResponse> {
        if (network === Network.Testnet) return { results: [] }
        const url = `${this.baseUrl}/v1/reserves?scope=${encodeURIComponent(scope)}`
        const response$ = this.httpService.get<ReservesResponse>(url)
        const response = await firstValueFrom(response$)
        return response.data
    }

    async getHistoricalInterestRates(params: {
        ids: Array<string>;
        span?: "1d"|"1w";
        network?: Network;
    }): Promise<HistoricalInterestRatesResponse> {
        if (params.network === Network.Testnet) return {}
        const url = `${this.baseUrl}/v1/reserves/historical-interest-rates?ids=${params.ids
            .map(encodeURIComponent)
            .join(",")}${params.span ? `&span=${encodeURIComponent(params.span)}` : ""}`
        const response$ = this.httpService.get<HistoricalInterestRatesResponse>(url)
        const response = await firstValueFrom(response$)
        return response.data
    }

    async getMarkets(
        scope: "all" | "permissionless" | "solend" = "all",
        network: Network
    ): Promise<MarketsResponse> {
        if (network === Network.Testnet) return { results: [] }
        const url = `${this.baseUrl}/v1/markets?scope=${encodeURIComponent(scope)}`
        const response$ = this.httpService.get<MarketsResponse>(url)
        const response = await firstValueFrom(response$)
        return response.data
    }

    async getExternalRewardStats(): Promise<Array<ExternalRewardStatType>> {
        const url = `${this.baseUrl}/liquidity-mining/external-reward-stats-v2?flat=true`
        const response$ = this.httpService.get<Array<ExternalRewardStatType>>(url)
        const response = await firstValueFrom(response$)
        return response.data ?? []
    }
}

export type ExternalRewardStatType = RewardStatType & {
    rewardMint: string;
    rewardSymbol: string;
    reserveID: string;
    side: "supply" | "borrow";
  };

export type RewardStatType = {
    rewardsPerShare: string;
    totalBalance: string;
    lastSlot: number;
    rewardRates: Array<{
      beginningSlot: number;
      rewardRate: string;
      name?: string;
    }>;
  } | null;
  