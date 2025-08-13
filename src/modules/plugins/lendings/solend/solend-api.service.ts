import { HttpService } from "@nestjs/axios"
import { Injectable } from "@nestjs/common"
import axiosRetry from "axios-retry"
import { firstValueFrom } from "rxjs"
import { Network } from "@/modules/common"

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

export interface GetHistoricalInterestRatesParams {
    ids: Array<string>; // reserve IDs comma separated or one string
    span?: string; // e.g. "1w", "1m", optional
    network?: Network;
}

// Interface cho Market
export interface Market {
    address: string;
    name: string;
    description: string;
    isPrimary: boolean;
    creator: string;
}

// Interface cho response API markets
export interface MarketsResponse {
    results: Array<Market>;
}

@Injectable()
export class SolendLendingApiService {
    private readonly baseUrl = "https://api.solend.fi/v1"

    constructor(private readonly httpService: HttpService) {
        axiosRetry(this.httpService.axiosRef, {
            retries: 3,
            retryDelay: (retryCount) => retryCount * 1000,
            retryCondition: (error) => {
                return (
                    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                    (error.response?.status ?? 0) >= 500
                )
            },
        })
    }

    async getHistoricalInterestRates(
        params: GetHistoricalInterestRatesParams,
    ): Promise<HistoricalInterestRatesResponse> {
        if (params.network === Network.Testnet) {
            return {}
        }
        const url = `${this.baseUrl}/reserves/historical-interest-rates?ids=${params.ids.map((id) => encodeURIComponent(id)).join(",")}${params.span ? `&span=${encodeURIComponent(params.span)}` : ""}`
        const response$ =
            this.httpService.get<HistoricalInterestRatesResponse>(url)
        const response = await firstValueFrom(response$)
        return response.data
    }

    async getMarkets(
        scope: "all" | "permissionless" | "solend" = "all",
        network: Network,
    ): Promise<MarketsResponse> {
        if (network === Network.Testnet) {
            return {
                results: [],
            }
        }
        const url = `${this.baseUrl}/markets?scope=${encodeURIComponent(scope)}`
        const response$ = this.httpService.get<MarketsResponse>(url)
        const response = await firstValueFrom(response$)
        return response.data
    }
}
