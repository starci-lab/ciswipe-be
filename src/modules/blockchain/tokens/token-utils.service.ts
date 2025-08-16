import { Injectable } from "@nestjs/common"
import { Token, TokenId, tokenPairs, tokens } from "./data"
import { ChainKey, Network, TokenType } from "@/modules/common"
@Injectable()
export class TokenUtilsService {
    getPairsWithoutNativeToken(chainKey: ChainKey, network: Network) {
        return tokenPairs[chainKey][network]
            .filter(
                ([token0, token1]) =>
                    token0.type !== TokenType.Native && token1.type !== TokenType.Native,
            )
            .map(([token0, token1]) => this.ensureTokensOrder(token0, token1))
    }

    getPairs(chainKey: ChainKey, network: Network) {
        return tokenPairs[chainKey][network].map(([token0, token1]) =>
            this.ensureTokensOrder(token0, token1),
        )
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

    ensureTokensOrderById(
        token1Id: TokenId, 
        token2Id: TokenId
    ) {
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

    getIndexByPair({
        token0,
        token1,
        withoutNative,
        chainKey,
        network,
    }: GetIndexByPairParams) {
        [token0, token1] = this.ensureTokensOrderById(token0, token1)
        const pairs = withoutNative
            ? this.getPairsWithoutNativeToken(chainKey, network)
            : this.getPairs(chainKey, network)
        const index = pairs.findIndex(
            ([token0Instance, token1Instance]) =>
                token0Instance.id === token0 && token1Instance.id === token1,
        )
        if (index === -1) {
            throw new Error(`Pair ${token0} ${token1} not found`)
        }
        return index
    }
}

export interface GetIndexByPairParams {
  token0: TokenId;
  token1: TokenId;
  withoutNative?: boolean;
  chainKey: ChainKey;
  network: Network;
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
