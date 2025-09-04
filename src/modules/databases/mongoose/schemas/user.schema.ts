import { Prop, Schema } from "@nestjs/mongoose"
import { AbstractSchema } from "./abstract"
import { Field } from "@nestjs/graphql"
import { OauthProviderName } from "../enums"
import { WalletSchema } from "./wallet.schema"

@Schema({
    timestamps: true,
    collection: "users",
})
export class UserSchema extends AbstractSchema {
    @Prop({ type: String, required: false })
        oauthProviderId?: string

    @Field(() => String, {
        description: "The oauth provider of the user",
        nullable: true,
    })
    @Prop({ type: String, enum: OauthProviderName, required: false })
        oauthProvider?: OauthProviderName

    @Prop({ type: String, required: false })
        email?: string

    @Prop({ type: String, required: false })
        username?: string

    @Prop({ type: String, required: false })
        picture?: string

    // 🔹 Multi-chain wallets
    @Field(() => WalletSchema, { nullable: true })
    @Prop({ type: WalletSchema, required: false })
        solana?: WalletSchema

    @Field(() => WalletSchema, { nullable: true })
    @Prop({ type: WalletSchema, required: false })
        sui?: WalletSchema

    @Field(() => WalletSchema, { nullable: true })
    @Prop({ type: WalletSchema, required: false })
        evm?: WalletSchema
}