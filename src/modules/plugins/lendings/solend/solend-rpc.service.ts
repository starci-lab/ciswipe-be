import { Inject, Injectable } from "@nestjs/common"
import { createProviderToken, RecordRpcProvider } from "@/modules/blockchain"
import { Connection } from "@solana/web3.js"
import { ChainKey, Network } from "@/modules/common"
import { PublicKey } from "@solana/web3.js"
import { Reserve } from "./schema"
import BigNumber from "bignumber.js"

const WAD = "1".concat(Array(18 + 1).join("0"))

const RESERVE_DATA_SIZE = 619
@Injectable()
export class SolendLendingRpcService {
    private readonly programId: Record<Network, PublicKey> = {
        [Network.Mainnet]: new PublicKey("So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo"),
        // use testnet program id for now, same to mainnet to prevent error
        [Network.Testnet]: new PublicKey("So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo"),
    }
    constructor(
        @Inject(createProviderToken(ChainKey.Solana))
        private readonly solanaRpcProvider: RecordRpcProvider<Connection>,
    ) {}

    // reserve
    async fetchReserves({
        network,
    }: FetchReservesParams): Promise<FetchReservesResult> {
        const filters = [{ dataSize: RESERVE_DATA_SIZE }] // data size of those accounts
        const reserveRaws = await this.solanaRpcProvider[network].getProgramAccounts(
            this.programId[network],
            {
                filters,
                commitment: "confirmed",
                encoding: "base64",
            }
        )
        const reserves: Array<WithAddressAndStats<Reserve>> = reserveRaws.map(r => {
            const [reserve] = Reserve.struct.deserialize(r.account.data)
            return {
                address: r.pubkey.toBase58(),
                data: reserve,
                supplyAPR: this.calculateSupplyAPR(reserve),
                borrowAPR: this.calculateBorrowAPR(reserve)
            }
        }).filter(r => r.data.version)
        return {
            reserves
        }
    }

    private calculateSupplyAPR(reserve: Reserve) {
        const currentUtilization = this.calculateUtilizationRatio(reserve)
    
        const borrowAPY = this.calculateBorrowAPR(reserve)
        return currentUtilization * borrowAPY
    }

    private calculateUtilizationRatio(reserve: Reserve) {
        const totalBorrowsWads = new BigNumber(
            reserve.liquidity.borrowedAmountWads.toString()
        ).div(WAD)
        const currentUtilization = totalBorrowsWads
            .dividedBy(
                totalBorrowsWads.plus(reserve.liquidity.availableAmount.toString())
            )
            .toNumber()
    
        return currentUtilization
    }

    private calculateBorrowAPR(reserve: Reserve) {
        const currentUtilization = this.calculateUtilizationRatio(reserve)
        const optimalUtilization = reserve.config.optimalUtilizationRate / 100
    
        let borrowAPR: number
        if (optimalUtilization === 1.0 || currentUtilization < optimalUtilization) {
            const normalizedFactor = currentUtilization / optimalUtilization
            const optimalBorrowRate = reserve.config.optimalBorrowRate / 100
            const minBorrowRate = reserve.config.minBorrowRate / 100
            borrowAPR =
            normalizedFactor * (optimalBorrowRate - minBorrowRate) + minBorrowRate
        } else {
            const normalizedFactor =
            (currentUtilization - optimalUtilization) / (1 - optimalUtilization)
            const optimalBorrowRate = reserve.config.optimalBorrowRate / 100
            const maxBorrowRate = reserve.config.maxBorrowRate / 100
            borrowAPR =
            normalizedFactor * (maxBorrowRate - optimalBorrowRate) +
            optimalBorrowRate
        }
    
        return borrowAPR
    }
}

export interface FetchReservesParams {
    network: Network
}

export interface FetchReservesResult {
    reserves: Array<WithAddressAndStats<Reserve>>
}

export interface WithAddressAndStats<T> {
    address: string
    data: T
    supplyAPR: number
    borrowAPR: number
}
