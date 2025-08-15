// import {
//     TokenId,
//     tokens,
// } from "@/modules/blockchain"
// import {
//     DexPluginAbstract,
//     GetDataParams,
//     V3Strategy,
//     V3ExecuteParams,
//     V3ExecuteResult,
//     StrategyType,
//     V3StrategyApr,
//     V3StrategyAprDuration,
// } from "../abstract"
// import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common"
// import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager"
// import { CetusApiResponse, CetusSdkService, PoolData } from "./cetus-sdk.service"
// import { ChainKey, computePercentage, Network } from "@/modules/common"
// import { VolumeService } from "@/modules/volume"

// @Injectable()
// export class CetusPluginService
//     extends DexPluginAbstract
//     implements OnApplicationBootstrap
// {
//     protected async getData(params: GetDataParams): Promise<CetusApiResponse> {
//         const volumeName = `cetus-${params.token1.id}-${params.token2.id}.json`
//         try {
//             if (!params.token1.tokenAddress || !params.token2.tokenAddress) {
//                 throw new Error("Token address is required")
//             }
//             const data = await this.cetusSdkService.getPools({
//                 coinTypes: [
//                     params.token1.tokenAddress,
//                     params.token2.tokenAddress,
//                 ],
//             })
//             await this.volumeService.writeJsonToDataVolume<CetusApiResponse>(
//                 volumeName,
//                 data, 
//             )
//             return data
//         } catch (error) {
//             console.error(error)
//             // if error happlen, we try to read from volume
//             // to ensure high-availability in case the provider refused to serve
//             try {
//                 return await this.volumeService.readJsonFromDataVolume<CetusApiResponse>(
//                     {
//                         name: volumeName,
//                     }
//                 )
//             } catch (error) {
//                 console.error(error)
//             }
//             throw error 
//         }
//     }

//     constructor(
//     @Inject(CACHE_MANAGER)
//     private readonly cacheManager: Cache,
//     private readonly volumeService: VolumeService,
//     private readonly cetusSdkService: CetusSdkService,
//     ) {
//         super({
//             name: "Cetus",
//             icon: "https://cetus.zone/favicon.ico",
//             url: "https://cetus.zone",
//             description: "Cetus is a decentralized exchange on Sui.",
//             tags: ["dex"],
//             chainKeys: [ChainKey.Sui],
//         })
//     }

//     async onApplicationBootstrap() {
//         const output = await this.v3Execute({
//             network: Network.Mainnet,
//             chainKey: ChainKey.Sui,
//             inputTokens: [
//                 {
//                     id: TokenId.SuiSuiMainnet,
//                 },
//                 {
//                     id: TokenId.SuiUsdcMainnet,
//                 },
//             ],
//         })
//         console.dir(output, { depth: null })
//     }

//     private getTokenIdByAddress(address: string): TokenId {
//         const tokenId = tokens[ChainKey.Sui][Network.Mainnet].find(
//             (token) => token.tokenAddress === address,
//         )?.id
//         if (!tokenId) {
//             throw new Error(`Token not found with given address: ${address}`)
//         }
//         return tokenId
//     }

//     private caculateAprForSpecificDuration(
//         pool: PoolData,
//         duration: V3StrategyAprDuration,
//     ): V3StrategyApr {
//         const durationMap = {
//             [V3StrategyAprDuration.Day]: "24H",
//             [V3StrategyAprDuration.Week]: "7D",
//             [V3StrategyAprDuration.Month]: "30D",
//         }
//         const durationKey = durationMap[duration]
//         const stats = pool.stats.find((stat) => stat.dateType === durationKey)
//         if (!stats) {
//             return {
//                 apr: 0,
//                 feeApr: 0,
//                 rewards: [],
//             }
//         }
//         const feeApr = computePercentage(parseFloat(stats.apr), 1, 5)
//         const rewardsApr = (pool.miningRewarders || [])
//             .filter((rewarder) => rewarder.display !== false) // Only include displayed rewards
//             .map((rewarder) => ({
//                 apr: computePercentage(parseFloat(rewarder.apr), 1, 5) || 0,
//                 tokenId: this.getTokenIdByAddress(rewarder.coinType),
//             }))
//             .filter((reward) => computePercentage(reward.apr, 1, 5) > 0) // Only include positive APRs
//         const apr =
//       feeApr + rewardsApr.reduce((sum, reward) => sum + reward.apr, 0)
//         return {
//             apr,
//             feeApr,
//             rewards: rewardsApr,
//         }
//     }

//     private calculateApr(
//         pool: PoolData,
//     ): Partial<Record<V3StrategyAprDuration, V3StrategyApr>> {
//         const dailyApr = this.caculateAprForSpecificDuration(
//             pool,
//             V3StrategyAprDuration.Day,
//         )
//         const weeklyApr = this.caculateAprForSpecificDuration(
//             pool,
//             V3StrategyAprDuration.Week,
//         )
//         const monthlyApr = this.caculateAprForSpecificDuration(
//             pool,
//             V3StrategyAprDuration.Month,
//         )
//         return {
//             [V3StrategyAprDuration.Day]: dailyApr,
//             [V3StrategyAprDuration.Week]: weeklyApr,
//             [V3StrategyAprDuration.Month]: monthlyApr,
//         }
//     }

//     protected async v3Execute(params: V3ExecuteParams): Promise<V3ExecuteResult> {
//     // cetus only support for sui so we dont care about chainKey parameter
//         if (params.inputTokens.length !== 2) {
//             throw new Error("Cetus only support for 2 tokens")
//         }
//         const [token1, token2] = params.inputTokens
//         const [token1Entity, token2Entity] = tokens[ChainKey.Sui][
//             params.network
//         ].filter((token) => token.id === token1.id || token.id === token2.id)
//         if (!token1Entity?.tokenAddress || !token2Entity?.tokenAddress) {
//             return {
//                 strategies: [],
//             }
//         }
//         const poolsData = await this.getData({
//             network: params.network,
//             chainKey: ChainKey.Sui,
//             token1: token1Entity,
//             token2: token2Entity,
//         })
//         const strategies: Array<V3Strategy> = await Promise.all(
//             (poolsData.list ?? []).map((pool) => {
//                 const aprs = this.calculateApr(pool)
//                 return {
//                     aprs,
//                     metadata: {
//                         poolId: pool.pool,
//                         feeRate: pool.feeRate,
//                         tvl: parseFloat(pool.tvl) || 0,
//                     },
//                     type: StrategyType.AddLiquidityV3,
//                 }
//             }),
//         )
//         return {
//             strategies,
//         }
//     }
// }
