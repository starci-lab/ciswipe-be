import { Injectable } from "@nestjs/common"
import { createHash } from "crypto"

@Injectable()
export class Sha256Service {
    public hash(data: string): string {
        return createHash("sha256").update(data).digest("hex")
    }
    public hashBuffer(data: Buffer): Buffer {
        return createHash("sha256").update(data).digest()
    }
}