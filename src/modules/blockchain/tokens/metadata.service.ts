import { Injectable, Logger } from "@nestjs/common"
import { Connection } from "@solana/web3.js"
import {  } from "@solana/spl-token-metadata"
import { ChainKey, Network } from "@/modules/common"

export interface GetMetadataParams {
    tokenAddress: string;
    network?: Network;
    chainKey?: ChainKey;
}

export interface TokenMetadata {
    tokenAddress: string
    name?: string 
    symbol?: string
    decimals?: number
    icon?: string
}

@Injectable()
export class TokenMetadataService {
    private readonly logger = new Logger(TokenMetadataService.name)

    constructor(private readonly connection: Connection) {}

    // async getMetadata(
    //     {
    //         tokenAddress,
    //         network = Network.Mainnet,
    //         chainKey = ChainKey.Solana,
    //     }: GetMetadataParams,
    // ): Promise<TokenMetadata> {
    //     switch (chainKey) {
    //     case ChainKey.Solana:
    //         //return this.getSolanaMetadata(tokenAddress);
    //         {

    //         }
    //     default:
    //         throw new Error(`Unsupported chain key: ${chainKey}`)
    //     }
    // }

    // private async getSolanaMetadata(tokenAddress: string): Promise<TokenMetadata> {
    //     try {
    //         // Convert token address to PublicKey
    //         const mintPublicKey = new PublicKey(tokenAddress)
            
    //         // Find the metadata PDA (Program Derived Address) for this mint
    //         const metadataPDA = getMetadata(mintPublicKey)
            
    //         // Fetch the metadata account
    //         const metadataAccount = await Metadata.load(this.connection, metadataPDA);
            
    //         return this.normalizeMetadata(metadataAccount);
    //     } catch (error) {
    //         this.logger.error(`Failed to fetch metadata for token ${tokenAddress}: ${error.message}`);
    //         throw new Error(`Failed to fetch token metadata: ${error.message}`);
    //     }
    // }

    // private normalizeMetadata(metadataAccount: Metadata): TokenMetadata {
    //     return {
    //         mint: metadataAccount.data.mint.toString(),
    //         name: metadataAccount.data.data.name,
    //         symbol: metadataAccount.data.data.symbol,
    //         uri: metadataAccount.data.data.uri,
    //         sellerFeeBasisPoints: metadataAccount.data.data.sellerFeeBasisPoints,
    //         creators: metadataAccount.data.data.creators?.map(creator => ({
    //             address: creator.address.toString(),
    //             verified: creator.verified,
    //             share: creator.share,
    //         })),
    //         collection: metadataAccount.data.collection
    //             ? {
    //                 key: metadataAccount.data.collection.key.toString(),
    //                 verified: metadataAccount.data.collection.verified,
    //             }
    //             : undefined,
    //         uses: metadataAccount.data.uses,
    //     };
    // }
}