import { Prop, Schema } from "@nestjs/mongoose"
import { Field, ObjectType } from "@nestjs/graphql"

@Schema({ _id: false })
@ObjectType()
export class WalletSchema {
    @Field(() => String, { nullable: true })
    @Prop({ type: String, required: false })
        publicKey?: string

    @Field(() => String, { nullable: true })
    @Prop({ type: String, required: false })
        encryptedPrivateKey?: string
}