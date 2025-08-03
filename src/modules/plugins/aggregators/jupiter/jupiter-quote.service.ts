import { Injectable } from "@nestjs/common"
import { createJupiterApiClient, QuoteGetRequest, QuoteResponse } from "@jup-ag/api"
import { ChainKey, Network, TokenId, tokens, TokenType } from "@/modules/blockchain"
import { computeDenomination, computePercentage } from "@/modules/common"


@Injectable()
export class JupiterQuoteService {
    private readonly client = createJupiterApiClient() // config optional: { basePath, apiKey }
    
    private async quoteRaw(request: QuoteRawParams): Promise<QuoteResponse> {
        if (request.network && request.network !== Network.Mainnet) {
            throw new Error("Jupiter only supports Solana mainnet")
        }
        try {
            return await this.client.quoteGet(request)
        } catch (error) {
            throw new Error(`Failed to fetch Jupiter quote: ${error.message}`)
        }
    }

    public async quote({
        amount,
        tokenInId,
        tokenOutId,
        slippageBps,
        network = Network.Mainnet,
    }: QuoteParams): Promise<QuoteResult> {
        if (tokenInId === tokenOutId) {
            throw new Error("Input and output token cannot be the same")
        }
        let tokenIn = tokens[ChainKey.Solana][network].find(
            tokenId => tokenId.id === tokenInId,
        )
        let tokenOut = tokens[ChainKey.Solana][network].find(
            tokenId => tokenId.id === tokenOutId,
        )
        // if either input token and output token is sol
        if (!tokenIn || !tokenOut) {
            throw new Error(`Token not found: ${tokenInId} or ${tokenOutId}`)
        }
        if (tokenIn.type === TokenType.Native) {
            const wrappedSol = tokens[ChainKey.Solana][network].find(
                token => token.type === TokenType.Wrapper
            )
            if (!wrappedSol) {
                throw new Error("Wrapped SOL token not found")
            }
            tokenIn = wrappedSol
        }
        if (tokenOut.type === TokenType.Native) {
            const wrappedSol = tokens[ChainKey.Solana][network].find(
                token => token.type === TokenType.Wrapper
            )
            if (!wrappedSol) {
                throw new Error("Wrapped SOL token not found")
            }
            tokenOut = wrappedSol
        }
        if (tokenIn.type === TokenType.Native) {
            const wrappedSol = tokens[ChainKey.Solana][network].find(
                token => token.type === TokenType.Wrapper
            )
            if (!wrappedSol) {
                throw new Error("Wrapped SOL token not found")
            }
            tokenIn = wrappedSol
        }
        if (!tokenIn.tokenAddress || !tokenOut.tokenAddress) {
            throw new Error(`Token address not found: ${tokenInId} or ${tokenOutId}`)
        }
        if (!tokenIn.decimals) {
            throw new Error(`Token ${tokenInId} decimals not found`)
        }
        const quoteResult = await this.quoteRaw({
            inputMint: tokenIn.tokenAddress,
            outputMint: tokenOut.tokenAddress,
            amount: Number(amount * 10 ** tokenIn.decimals),
            slippageBps: slippageBps || 50,
        })
        return {
            amountOut: computeDenomination(BigInt(quoteResult.outAmount), tokenOut.decimals),
            priceImpact: computePercentage(Number.parseFloat(quoteResult.priceImpactPct), 1, 5)
        }
    }

    public async getPrice({
        tokenInId,
        tokenOutId,
        network = Network.Mainnet,
    }: GetPriceParams): Promise<GetPriceResult> {
        const { amountOut } = await this.quote({
            tokenInId,
            tokenOutId,
            network,
            amount: 1,
        })
        return {
            price: amountOut,
        }
    }   
}

export interface QuoteRawParams extends QuoteGetRequest {
    network?: Network
}

export interface QuoteParams {
    amount: number
    tokenInId: TokenId
    tokenOutId: TokenId
    slippageBps?: number
    network?: Network
}

export interface QuoteResult {
    amountOut: number
    priceImpact: number
}

export interface GetPriceParams {
    tokenInId: TokenId
    tokenOutId: TokenId
    network?: Network
}

export interface GetPriceResult {
    price: number
}