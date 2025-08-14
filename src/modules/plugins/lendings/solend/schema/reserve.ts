import {
    u8,
    u64,
    u128,
    BeetStruct,
    bignum,
    uniformFixedSizeArray,
} from "@metaplex-foundation/beet"
import { PublicKey } from "@solana/web3.js"
import { publicKey } from "@metaplex-foundation/beet-solana"
import { LastUpdate } from "./last-update"
import { RateLimiter } from "./rate-limiter"

/**
 * Asset type enum
 */
export enum AssetType {
  Regular = 0,
  Isolated = 1,
}

/**
 * Reserve Liquidity struct
 */
export class ReserveLiquidity {
    constructor(
    readonly mintPubkey: PublicKey,
    readonly mintDecimals: number,
    readonly supplyPubkey: PublicKey,
    readonly pythOracle: PublicKey,
    readonly switchboardOracle: PublicKey,
    readonly availableAmount: bignum,
    readonly borrowedAmountWads: bignum,
    readonly cummlativeBorrowRateWads: bignum,
    readonly marketPrice: bignum,
    ) {}

    static readonly struct = new BeetStruct<ReserveLiquidity>(
        [
            ["mintPubkey", publicKey],
            ["mintDecimals", u8],
            ["supplyPubkey", publicKey],
            ["pythOracle", publicKey],
            ["switchboardOracle", publicKey],
            ["availableAmount", u64],
            ["borrowedAmountWads", u128],
            ["cummlativeBorrowRateWads", u128],
            ["marketPrice", u128],
        ],
        (args) =>
            new ReserveLiquidity(
        args.mintPubkey!,
        args.mintDecimals!,
        args.supplyPubkey!,
        args.pythOracle!,
        args.switchboardOracle!,
        args.availableAmount!,
        args.borrowedAmountWads!,
        args.cummlativeBorrowRateWads!,
        args.marketPrice!,
            ),  "ReserveLiquidity",
    )
}

/**
 * Reserve Collateral struct
 */
export class ReserveCollateral {
    constructor(
    readonly mintPubkey: PublicKey,
    readonly mintTotalSupply: bignum,
    readonly supplyPubkey: PublicKey,
    ) {}
    static readonly struct = new BeetStruct<ReserveCollateral>(
        [
            ["mintPubkey", publicKey],
            ["mintTotalSupply", u64],
            ["supplyPubkey", publicKey],
        ],
        (args) =>
            new ReserveCollateral(
        args.mintPubkey!,
        args.mintTotalSupply!,
        args.supplyPubkey!,
            ),
        "ReserveCollateral",
    )
}

/**
 * Fees struct
 */
export class ReserveFees {
    constructor(
    readonly borrowFeeWad: bignum,
    readonly flashLoanFeeWad: bignum,
    readonly hostFeePercentage: number,
    ) {}

    static readonly struct = new BeetStruct<ReserveFees>(
        [
            ["borrowFeeWad", u64],
            ["flashLoanFeeWad", u64],
            ["hostFeePercentage", u8],
        ],
        (args) =>
            new ReserveFees(
        args.borrowFeeWad!,
        args.flashLoanFeeWad!,
        args.hostFeePercentage!,
            ),
        "ReserveFees",
    )
}

/**
 * Reserve On-chain Config struct
 */
export class ReserveConfig {
    constructor(
    readonly optimalUtilizationRate: number,
    readonly loanToValueRatio: number,
    readonly liquidationBonus: number,
    readonly liquidationThreshold: number,
    readonly minBorrowRate: number,
    readonly optimalBorrowRate: number,
    readonly maxBorrowRate: number,
    readonly fees: ReserveFees,
    readonly depositLimit: bignum,
    readonly borrowLimit: bignum,
    readonly feeReceiver: PublicKey,
    readonly protocolLiquidationFee: number,
    readonly protocolTakeRate: number,
    ) {}

    static readonly struct = new BeetStruct<ReserveConfig>(
        [
            ["optimalUtilizationRate", u8],
            ["loanToValueRatio", u8],
            ["liquidationBonus", u8],
            ["liquidationThreshold", u8],
            ["minBorrowRate", u8],
            ["optimalBorrowRate", u8],
            ["maxBorrowRate", u8],
            ["fees", ReserveFees.struct],
            ["depositLimit", u64],
            ["borrowLimit", u64],
            ["feeReceiver", publicKey],
            ["protocolLiquidationFee", u8],
            ["protocolTakeRate", u8],
        ],
        (args) =>
            new ReserveConfig(
        args.optimalUtilizationRate!,
        args.loanToValueRatio!,
        args.liquidationBonus!,
        args.liquidationThreshold!,
        args.minBorrowRate!,
        args.optimalBorrowRate!,
        args.maxBorrowRate!,
        args.fees!,
        args.depositLimit!,
        args.borrowLimit!,
        args.feeReceiver!,
        args.protocolLiquidationFee!,
        args.protocolTakeRate!,
            ),
        "ReserveConfig",
    )
}

/**
 * Main Reserve struct
 */
export class Reserve {
    constructor(
    readonly version: number,
    readonly lastUpdate: LastUpdate,
    readonly lendingMarket: PublicKey,
    readonly liquidity: ReserveLiquidity,
    readonly collateral: ReserveCollateral,
    readonly config: ReserveConfig,
    readonly rateLimiter: RateLimiter,
    readonly padding: Array<number>,
    ) {}

    static readonly struct = new BeetStruct<Reserve>(
        [
            ["version", u8],
            ["lastUpdate", LastUpdate.struct],
            ["lendingMarket", publicKey],
            ["liquidity", ReserveLiquidity.struct],
            ["collateral", ReserveCollateral.struct],
            ["config", ReserveConfig.struct],
            ["rateLimiter", RateLimiter.struct],
            ["padding", uniformFixedSizeArray(u8, 49)],
        ],
        (args) =>
            new Reserve(
        args.version!,
        args.lastUpdate!,
        args.lendingMarket!,
        args.liquidity!,
        args.collateral!,
        args.config!,
        args.rateLimiter!,
        args.padding!,
            ),
        "Reserve",
    )
}
