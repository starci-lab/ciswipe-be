import { HttpService } from "@nestjs/axios"
import { Injectable, InternalServerErrorException } from "@nestjs/common"
import { lastValueFrom } from "rxjs"

export interface LiquidityLine {
    time: number; // UNIX timestamp (seconds)
    liquidity: number;
}

interface PoolLineResponse {
    id: string;
    success: boolean;
    data: {
        count: number;
        line: Array<LiquidityLine>;
    };
}

export interface PositionLine {
    price: number; // Price at tick
    liquidity: string; // Liquidity at price
    tick: number; // Tick index in AMM
}

interface PoolPositionResponse {
    id: string;
    success: boolean;
    data: {
        count: number;
        line: Array<PositionLine>;
    };
}

@Injectable()
export class RaydiumDexApiService {
    constructor(private readonly httpService: HttpService) { }

    async fetchPoolLines(poolId: string): Promise<Array<LiquidityLine>> {
        const url = `https://api-v3.raydium.io/pools/line/liquidity?id=${poolId}`

        const response$ = this.httpService.get<PoolLineResponse>(url)
        const response = await lastValueFrom(response$)
        if (!response.data.success) {
            throw new InternalServerErrorException(`Failed to fetch liquidity for pool ${poolId}`)
        }
        return response.data.data.line
    }

    async fetchPoolPositions(poolId: string): Promise<PositionLine[]> {
        const url = `https://api-v3.raydium.io/pools/line/position?id=${poolId}`
        const response$ = this.httpService.get<PoolPositionResponse>(url)
        const response = await lastValueFrom(response$)

        if (!response.data.success) {
            throw new InternalServerErrorException(`Failed to fetch positions for pool ${poolId}`)
        }
        return response.data.data.line
    }
}
