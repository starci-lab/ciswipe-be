import { Injectable } from "@nestjs/common"
import { GcpKmsService } from "@/modules/gcp"
import { Wallet } from "ethers"
import { Keypair as SolanaKeypair } from "@solana/web3.js"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import base58 from "bs58"
import { WalletSchema } from "@/modules/databases"

export interface Keypairs {
    evmKeypair: WalletSchema
    suiKeypair: WalletSchema
    solanaKeypair: WalletSchema
}

@Injectable()
export class KeypairsService {
    constructor(
        private readonly gcpKmsService: GcpKmsService
    ) {}
    
    public async generateKeypairs(): Promise<Keypairs> {
        const evmWallet = Wallet.createRandom()
        const suiWallet = Ed25519Keypair.generate()
        const solanaWallet = SolanaKeypair.generate()
        const [evmEncryptedPrivateKey, suiEncryptedPrivateKey, solanaEncryptedPrivateKey] = await Promise.all([
            this.gcpKmsService.encrypt(evmWallet.privateKey),
            this.gcpKmsService.encrypt(suiWallet.getSecretKey()),
            this.gcpKmsService.encrypt(base58.encode(solanaWallet.secretKey))
        ])
        return {
            evmKeypair: {
                publicKey: evmWallet.address,
                encryptedPrivateKey: evmEncryptedPrivateKey
            },
            suiKeypair: {
                publicKey: suiWallet.getPublicKey().toSuiAddress(),
                encryptedPrivateKey: suiEncryptedPrivateKey
            },
            solanaKeypair: {
                publicKey: solanaWallet.publicKey.toBase58(),
                encryptedPrivateKey: solanaEncryptedPrivateKey
            }
        }
    }
}