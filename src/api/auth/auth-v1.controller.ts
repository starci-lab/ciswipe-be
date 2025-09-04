import { Controller, Get, UseGuards } from "@nestjs/common"
import { GoogleAuthGuard } from "@/modules/passport"
import {
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger"

@ApiTags("Auth v1")
@Controller({
    path: "auth",
    version: "1",
})
export class AuthV1Controller {
    constructor() {}

  @ApiOperation({
      summary: "Google OAuth2 Redirect (v1)",
      description:
      "Initiates the Google OAuth2 login flow by redirecting the user to Google's login page.",
  })
  @ApiResponse({ status: 302, description: "Redirects to Google login page" })
  @ApiResponse({ status: 401, description: "Unauthorized - authentication failed" })
  @ApiResponse({ status: 403, description: "Forbidden - user not allowed" })
  @UseGuards(GoogleAuthGuard)
  @Get("google/redirect")
    async redirectToGoogle() {
    // handled by GoogleAuthGuard -> redirects to Google
    }

  @ApiOperation({
      summary: "Google OAuth2 Callback (v1)",
      description:
      "Handles the callback from Google after user consent. " +
      "If successful, extracts user information and continues authentication flow.",
  })
  @ApiResponse({ status: 200, description: "Successfully authenticated with Google" })
  @ApiResponse({ status: 401, description: "Unauthorized - invalid or expired credentials" })
  @ApiResponse({ status: 403, description: "Forbidden - user not allowed" })
  @UseGuards(GoogleAuthGuard)
  @Get("google/callback")
  async handleGoogleCallback() {
      return { message: "Google authentication successful" }
  }
}