import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types"
import { AbstractAuthModuleProvider, isString, MedusaError } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"

type InjectedDependencies = {
  logger: Logger
}

type BetterAuthBridgeOptions = {
  secret: string
}

type BetterAuthBridgeClaims = {
  sub: string
  email: string
  email_verified?: boolean
}

/**
 * Bridges better-auth (kept as-is on Cloudflare Workers + D1 — passkeys, TOTP,
 * OAuth, magic links, HIBP) into Medusa's customer auth. Medusa never sees a
 * password: better-auth mints a short-lived HS256 token after it has already
 * done the real authentication, and this provider only verifies that token
 * and resolves/creates the matching Medusa AuthIdentity (join key: email).
 */
export class BetterAuthBridgeService extends AbstractAuthModuleProvider {
  static identifier = "better-auth-bridge"
  static DISPLAY_NAME = "Better Auth Bridge"

  protected config_: BetterAuthBridgeOptions
  protected logger_: Logger

  constructor({ logger }: InjectedDependencies, options: BetterAuthBridgeOptions) {
    // @ts-ignore - mirrors @medusajs/auth-emailpass's own provider constructor
    super(...arguments)
    this.config_ = options
    this.logger_ = logger
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.secret || !isString(options.secret)) {
      throw new Error(
        "better-auth-bridge requires a `secret` option (BETTER_AUTH_BRIDGE_SECRET), shared with the better-auth service that mints the bridge token"
      )
    }
  }

  protected verifyBridgeToken(token: string): BetterAuthBridgeClaims {
    return jwt.verify(token, this.config_.secret, {
      algorithms: ["HS256"],
    }) as BetterAuthBridgeClaims
  }

  async authenticate(
    userData: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const { token } = (userData.body ?? {}) as { token?: string }

    if (!token || !isString(token)) {
      return { success: false, error: "token should be a string" }
    }

    let claims: BetterAuthBridgeClaims
    try {
      claims = this.verifyBridgeToken(token)
    } catch (error) {
      return { success: false, error: "Invalid or expired bridge token" }
    }

    if (!claims.email || !claims.email_verified) {
      return { success: false, error: "Email not verified" }
    }

    try {
      const authIdentity = await authIdentityService.retrieve({
        entity_id: claims.email,
      })
      return { success: true, authIdentity }
    } catch (error) {
      if ((error as { type?: string }).type !== MedusaError.Types.NOT_FOUND) {
        return { success: false, error: (error as Error).message }
      }
    }

    try {
      const authIdentity = await authIdentityService.create({
        entity_id: claims.email,
        provider_metadata: { better_auth_user_id: claims.sub },
      })
      return { success: true, authIdentity }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  // better-auth already owns "does this account exist" (password/passkey/OAuth/
  // 2FA all live there), so register() doesn't need emailpass's separate
  // exists-check dance — it's the same find-or-create as authenticate().
  async register(
    userData: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return this.authenticate(userData, authIdentityService)
  }
}
