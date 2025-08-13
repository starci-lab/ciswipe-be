import { HttpService } from "@nestjs/axios"
import { Injectable } from "@nestjs/common/decorators"
import axiosRetry from "axios-retry"

// ========== Interfaces for Method Parameters ==========
interface GetUserTransactionsParams {
  shareholderPubkey: string;
  cluster?: string; // default: "mainnet-beta"
}

interface GetAllocationTransactionsParams {
  vaultPubkey: string;
  cluster?: string;
}

interface GetVaultMetricsParams {
  vaultPubkey: string;
}

interface GetVaultMetricsHistoryParams {
  vaultPubkey: string;
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
}

interface GetAllocationVolumeHistoryParams {
  vaultPubkey: string;
  startDate: string;
  endDate: string;
  cluster?: string;
}

interface GetUserVaultMetricsHistoryParams {
  vaultPubkey: string;
  userPubkey: string;
  startDate: string;
  endDate: string;
}

interface GetUserTotalMetricsHistoryParams {
  userPubkey: string;
  startDate: string;
  endDate: string;
}

interface GetUserVaultPnlParams {
  vaultPubkey: string;
  userPubkey: string;
}

interface GetUserVaultPnlHistoryParams {
  vaultPubkey: string;
  userPubkey: string;
}

interface GetKvaultTokenMetadataParams {
  mint: string;
}

interface GetKvaultTokenImageParams {
  mint: string;
}

// ========== Interfaces for Response Data ==========
interface UserTransaction {
  createdOn: string;
  instruction: string;
  tokenMint: string;
  tokenAmount: string;
  usdValue: string;
  transaction: string;
}

interface AllocationTransaction {
  createdOn: string;
  tx: string;
  market: string;
  reserve: string;
  solPrice: string;
  tokenPrice: string;
  tokenAmount: string;
}

export interface VaultMetrics {
  apy7d: string;
  apy24h: string;
  apy30d: string;
  apy90d: string;
  apy180d: string;
  apy365d: string;
  tokenPrice: string;
  solPrice: string;
  tokensAvailable: string;
  tokensAvailableUsd: string;
  tokensInvested: string;
  tokensInvestedUsd: string;
  sharePrice: string;
  tokensPerShare: string;
  apy: string;
  numberOfHolders: number;
  sharesIssued: string;
  cumulativeInterestEarned: string;
  cumulativeInterestEarnedUsd: string;
  cumulativeInterestEarnedSol: string;
  interestEarnedPerSecond: string;
  interestEarnedPerSecondUsd: string;
  interestEarnedPerSecondSol: string;
  cumulativePerformanceFees: string;
  cumulativePerformanceFeesUsd: string;
  cumulativePerformanceFeesSol: string;
  cumulativeManagementFees: string;
  cumulativeManagementFeesUsd: string;
  cumulativeManagementFeesSol: string;
}

export interface VaultMetricsHistoryItem {
  timestamp: string;
  tvl: string;
  solTvl: string;
  apy: string;
  sharePrice: string;
  interest: string;
  interestUsd: string;
  interestSol: string;
}

interface AllocationVolumeHistoryItem {
  timestamp: string;
  volumeUsd: string;
}

interface UserVaultMetricsHistoryItem {
  createdOn: string;
  sharesAmount: string;
  usdAmount: string;
  solAmount: string;
  apy: string;
  cumulativeInterestEarned: string;
  cumulativeInterestEarnedUsd: string;
  cumulativeInterestEarnedSol: string;
  interestEarnedPerSecond: string;
  interestEarnedPerSecondUsd: string;
  interestEarnedPerSecondSol: string;
}

interface UserTotalMetricsHistoryItem {
  createdOn: string;
  usdAmount: string;
  solAmount: string;
  weightedApy: string;
  cumulativeInterestEarnedUsd: string;
  cumulativeInterestEarnedSol: string;
  interestEarnedPerSecondUsd: string;
  interestEarnedPerSecondSol: string;
}

interface PnlValue {
  token: string;
  sol: string;
  usd: string;
}

interface UserVaultPnl {
  totalCostBasis: PnlValue;
  totalPnl: PnlValue;
}

interface PnlHistoryItem {
  timestamp: string;
  type: string;
  position: string;
  quantity: string;
  tokenPrice: PnlValue;
  sharePrice: PnlValue;
  investment: PnlValue;
  costBasis: PnlValue;
  realizedPnl: PnlValue;
  pnl: PnlValue;
  positionValue: PnlValue;
}

interface UserVaultPnlHistory {
  history: PnlHistoryItem[];
  totalPnl: PnlValue;
  totalCostBasis: PnlValue;
}

interface KvaultTokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  // Add other fields from actual API response
}

// ========== Updated Service with Typed Methods ==========
@Injectable()
export class KaminoVaultApiService {
    private readonly baseUrl = "https://api.kamino.finance"
    private readonly hubbleBaseUrl = "https://api.hubbleprotocol.io"

    constructor(private readonly httpService: HttpService) {
        axiosRetry(this.httpService.axiosRef, {
            retries: 3,
            retryDelay: retryCount => retryCount * 1000,
            retryCondition: error => {
                return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                   (error.response?.status ?? 0) >= 500 // only retry if server or network error
            },
        })
    }

    async getUserTransactions(
        params: GetUserTransactionsParams,
    ): Promise<Array<UserTransaction>> {
        const url = `${this.baseUrl}/kvaults/shareholders/${params.shareholderPubkey}/transactions?env=${params.cluster || "mainnet-beta"}`
        const response =
      await this.httpService.axiosRef.get<Array<UserTransaction>>(url)
        return response.data
    }

    async getAllocationTransactions(
        params: GetAllocationTransactionsParams,
    ): Promise<Array<AllocationTransaction>> {
        let url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/allocation-transactions`
        if (params.cluster) {
            url += `?env=${params.cluster}`
        }
        const response =
      await this.httpService.axiosRef.get<Array<AllocationTransaction>>(url)
        return response.data
    }

    async getVaultMetrics(params: GetVaultMetricsParams): Promise<VaultMetrics> {
        const url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/metrics`
        const response = await this.httpService.axiosRef.get<VaultMetrics>(url)
        return response.data
    }

    async getVaultMetricsHistory(
        params: GetVaultMetricsHistoryParams,
    ): Promise<Array<VaultMetricsHistoryItem>> {
        const url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/metrics/history?start=${encodeURIComponent(
            params.startDate,
        )}&end=${encodeURIComponent(params.endDate)}`
        const response =
      await this.httpService.axiosRef.get<VaultMetricsHistoryItem[]>(url)
        return response.data
    }

    async getAllocationVolumeHistory(
        params: GetAllocationVolumeHistoryParams,
    ): Promise<Array<AllocationVolumeHistoryItem>> {
        let url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/allocation-volume/history?start=${encodeURIComponent(
            params.startDate,
        )}&end=${encodeURIComponent(params.endDate)}`
        if (params.cluster) {
            url += `&env=${params.cluster}`
        }
        const response =
      await this.httpService.axiosRef.get<AllocationVolumeHistoryItem[]>(url)
        return response.data
    }

    async getUserVaultMetricsHistory(
        params: GetUserVaultMetricsHistoryParams,
    ): Promise<Array<UserVaultMetricsHistoryItem>> {
        const url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/users/${params.userPubkey}/metrics/history?start=${encodeURIComponent(
            params.startDate,
        )}&end=${encodeURIComponent(params.endDate)}`
        const response =
      await this.httpService.axiosRef.get<UserVaultMetricsHistoryItem[]>(url)
        return response.data
    }

    async getUserTotalMetricsHistory(
        params: GetUserTotalMetricsHistoryParams,
    ): Promise<Array<UserTotalMetricsHistoryItem>> {
        const url = `${this.baseUrl}/kvaults/users/${params.userPubkey}/metrics/history?start=${encodeURIComponent(
            params.startDate,
        )}&end=${encodeURIComponent(params.endDate)}`
        const response =
      await this.httpService.axiosRef.get<UserTotalMetricsHistoryItem[]>(url)
        return response.data
    }

    async getUserVaultPnl(params: GetUserVaultPnlParams): Promise<UserVaultPnl> {
        const url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/users/${params.userPubkey}/pnl`
        const response = await this.httpService.axiosRef.get<UserVaultPnl>(url)
        return response.data
    }

    async getUserVaultPnlHistory(
        params: GetUserVaultPnlHistoryParams,
    ): Promise<UserVaultPnlHistory> {
        const url = `${this.baseUrl}/kvaults/${params.vaultPubkey}/users/${params.userPubkey}/pnl/history`
        const response =
      await this.httpService.axiosRef.get<UserVaultPnlHistory>(url)
        return response.data
    }

    async getKvaultTokenMetadata(
        params: GetKvaultTokenMetadataParams,
    ): Promise<KvaultTokenMetadata> {
        const url = `${this.hubbleBaseUrl}/kvault-tokens/${params.mint}/metadata`
        const response =
      await this.httpService.axiosRef.get<KvaultTokenMetadata>(url)
        return response.data
    }

    async getKvaultTokenImage(
        params: GetKvaultTokenImageParams,
    ): Promise<string> {
        const url = `${this.hubbleBaseUrl}/kvault-tokens/${params.mint}/metadata/image.svg`
        const response = await this.httpService.axiosRef.get<string>(url, {
            responseType: "text",
        })
        return response.data
    }
}
