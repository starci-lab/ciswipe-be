import { Injectable } from "@nestjs/common"
import { KeyManagementServiceClient } from "@google-cloud/kms"
import { envConfig } from "../env/config"
import { InjectGcpKmsClient } from "./gpc.decorators"

@Injectable()
export class GcpKmsService {
    constructor(
        @InjectGcpKmsClient()
        private readonly kmsClient: KeyManagementServiceClient
    ) {}
    /**
   * Encrypt data by Google KMS
   */
    async encrypt(plaintext: string): Promise<string> {
        const [result] = await this.kmsClient.encrypt({
            name: envConfig().googleCloud.kms.keyName, // projects/<project-id>/locations/<location>/keyRings/<ring>/cryptoKeys/<key>
            plaintext: Buffer.from(plaintext),
        })
        return result.ciphertext?.toString("base64") || ""
    }

    /**
   * Decrypt data by Google KMS
   */
    async decrypt(ciphertext: string): Promise<string> {
        const [result] = await this.kmsClient.decrypt({
            name: envConfig().googleCloud.kms.keyName,
            ciphertext: Buffer.from(ciphertext, "base64"),
        })
        return result.plaintext?.toString() || ""
    }
}