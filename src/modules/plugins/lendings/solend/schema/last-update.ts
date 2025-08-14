import { u64, u8, BeetStruct, bignum } from "@metaplex-foundation/beet"

/**
 * LastUpdate: save slot and stale status
 */
export class LastUpdate {
    constructor(
    readonly slot: bignum,
    readonly stale: number // 0 or 1
    ) {}

    static readonly struct = new BeetStruct<LastUpdate>(
        [
            ["slot", u64],
            ["stale", u8],
        ],
        (args) => new LastUpdate(args.slot!, args.stale!),
        "LastUpdate"
    )

    /*Return stale as boolean*/
    isStale(): boolean {
        return this.stale !== 0
    }
}