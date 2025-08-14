import { FixedSizeBeet } from "@metaplex-foundation/beet"
import BN from "bn.js"
import { Buffer } from "buffer" // Node.js Buffer

export const u192: FixedSizeBeet<BN> = {
    byteSize: 24,
    read: (buf: Buffer, offset: number) => {
        const num = new BN(buf.subarray(offset, offset + 24), "le")
        return num
    },
    write: (buf: Buffer, offset: number, value: BN) => {
        const bytes = value.toBuffer("le", 24)
        bytes.copy(buf, offset)
    },
    description: "u192",
}