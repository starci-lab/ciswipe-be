import { Field, ObjectType } from "@nestjs/graphql"
import { ApiProperty } from "@nestjs/swagger"
import { IsJWT, IsUUID } from "class-validator"

@ObjectType()
export class AuthV1ResponseDto {
  @ApiProperty({
      description: "JWT access token, valid for short-term authentication",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  })
  @Field(() => String)
  @IsJWT()
      accessToken: string

  @ApiProperty({
      description: "Refresh token in UUID v4 format, used to renew access tokens",
      example: "550e8400-e29b-41d4-a716-446655440000"
  })
  @IsUUID("4")
  @Field(() => String)
      refreshToken: string
}
