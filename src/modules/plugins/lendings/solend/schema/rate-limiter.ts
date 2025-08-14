import { u64, BeetStruct, bignum, u128 } from "@metaplex-foundation/beet"

export class RateLimiterConfig {
    constructor(
      readonly maxOutflow: bignum,
      readonly windowDuration: bignum
    ) {}
  
    static readonly struct = new BeetStruct<RateLimiterConfig>(
        [
            ["maxOutflow", u64],
            ["windowDuration", u64],
        ],
        (args) => new RateLimiterConfig(args.maxOutflow!, args.windowDuration!),
        "RateLimiterConfig"
    )
}

export class RateLimiter {
    constructor(
      readonly config: RateLimiterConfig,
      readonly previousQuantity: bignum,
      readonly windowStart: bignum,
      readonly currentQuantity: bignum
    ) {}
  
    static readonly struct = new BeetStruct<RateLimiter>(
        [
            ["config", RateLimiterConfig.struct],
            ["previousQuantity", u128],
            ["windowStart", u64],
            ["currentQuantity", u128],
        ],
        (args) =>
            new RateLimiter(
          args.config!,
          args.previousQuantity!,
          args.windowStart!,
          args.currentQuantity!
            ),
        "RateLimiter"
    )
}
