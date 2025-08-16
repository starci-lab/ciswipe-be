import { Injectable } from "@nestjs/common"
import { Token, tokenPairs, tokens } from "./data"
import { ChainKey, Network, TokenType } from "@/modules/common"
@Injectable()
export class TokenUtilsService {
    
    getPairsWithoutNativeToken(chainKey: ChainKey, network: Network) {
        return tokenPairs[chainKey][network].filter(
            ([token0, token1]) =>
                token0.type !== TokenType.Native && token1.type !== TokenType.Native,
        ).map(([token0, token1]) => this.ensureTokensOrder(token0, token1))
    }

    ensureTokensOrder(token1: Token, token2: Token) {
        if (Buffer.byteLength(token1.id) > Buffer.byteLength(token2.id)) {
            [token1, token2] = [token2, token1]
        }
        return [token1, token2]
    }

    // create key like sui
    createKey(...args: Array<string>) {
        return args.join("::")
    }

    ensureTokensOrderById(token1Id: string, token2Id: string) {
        if (Buffer.byteLength(token1Id) > Buffer.byteLength(token2Id)) {
            [token1Id, token2Id] = [token2Id, token1Id]
        }
        return [token1Id, token2Id]
    }

    tryGetWrappedToken({ token, network, chainKey }: TryGetWrappedTokenParams) {
        if (token.type === TokenType.Native) {
            const wrapper = tokens[chainKey][network].find(
                (token) => token.type === TokenType.Wrapper,
            )
            if (wrapper) {
                return wrapper
            }
        }
        return token
    }

    tryGetWrappedTokens({
        tokens,
        network,
        chainKey,
    }: TryGetWrappedTokensParams) {
        return tokens.map((token) =>
            this.tryGetWrappedToken({ token, network, chainKey }),
        )
    }
}

export interface TryGetWrappedTokenParams {
  token: Token;
  network: Network;
  chainKey: ChainKey;
}

export interface TryGetWrappedTokensParams {
  tokens: Array<Token>;
  network: Network;
  chainKey: ChainKey;
}
