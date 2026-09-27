import { describe, expect, it } from "vitest";
import {
  CLAIM_GRANT,
  JWT_BEARER_GRANT,
  MAX_CODE_FAILURES,
  checkClaimAttempt,
  decidePoll,
  isEmail,
  maskEmail,
  randomToken,
  randomUserCode,
  sameHash,
  sha256Hex,
  type RegistrationState,
} from "./agent-auth-core";
import { accountMcpDispatcher, missingScope } from "./account-mcp";
import { ACCOUNT_TOOL_NAMES, accountToolDefinitions } from "./account-tools";
import { authMdDocument } from "./auth-md";
import {
  POST_CLAIM_SCOPES,
  bearerChallenge,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  protectedResources,
} from "./oauth";

const ISSUER = "https://swiss3design.ch";
const NOW = new Date("2026-09-27T12:00:00Z");
const later = (s: number) => new Date(NOW.getTime() + s * 1000);

describe("secrets auth.md", () => {
  it("tire des codes à 6 chiffres et des jetons préfixés", () => {
    for (let i = 0; i < 200; i++) expect(randomUserCode()).toMatch(/^\d{6}$/);
    const token = randomToken("clm_");
    expect(token).toMatch(/^clm_[A-Za-z0-9_-]{43}$/);
    expect(randomToken("clm_")).not.toBe(token);
  });

  it("hache en SHA-256 et compare à temps constant", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sameHash("ab", "ab")).toBe(true);
    expect(sameHash("ab", "ac")).toBe(false);
    expect(sameHash("ab", "abc")).toBe(false);
  });

  it("valide et masque les e-mails", () => {
    expect(isEmail("client@example.ch")).toBe(true);
    expect(isEmail("pas un email")).toBe(false);
    expect(isEmail(42)).toBe(false);
    expect(maskEmail("jeanne@example.ch")).toBe("j•••@example.ch");
  });
});

describe("sondage de la cérémonie (grant claim)", () => {
  const pending: RegistrationState = {
    status: "unclaimed",
    claimExpiresAt: later(3600),
    attemptTokenHash: "h",
    attemptExpiresAt: later(300),
    deniedAt: null,
    claimedAt: null,
    redeemedAt: null,
    lastPolledAt: null,
  };
  const error = (reg: RegistrationState) => {
    const decision = decidePoll(reg, NOW);
    return decision.kind === "error" ? decision.error : decision.kind;
  };

  it("suit le vocabulaire RFC 8628", () => {
    expect(error(pending)).toBe("authorization_pending");
    expect(error({ ...pending, lastPolledAt: later(-2) })).toBe("slow_down");
    expect(error({ ...pending, lastPolledAt: later(-6) })).toBe(
      "authorization_pending",
    );
    expect(error({ ...pending, attemptExpiresAt: later(-1) })).toBe(
      "expired_token",
    );
    expect(error({ ...pending, claimExpiresAt: later(-1) })).toBe(
      "expired_token",
    );
    expect(error({ ...pending, attemptTokenHash: null })).toBe("invalid_grant");
    expect(error({ ...pending, deniedAt: NOW, status: "revoked" })).toBe(
      "access_denied",
    );
    expect(error({ ...pending, status: "revoked" })).toBe("invalid_grant");
  });

  it("remet le jeton une seule fois après revendication", () => {
    const claimed = {
      ...pending,
      status: "claimed" as const,
      claimedAt: NOW,
      attemptTokenHash: null,
    };
    expect(error(claimed)).toBe("ready");
    // Pas de slow_down sur le sondage gagnant.
    expect(error({ ...claimed, lastPolledAt: later(-1) })).toBe("ready");
    expect(error({ ...claimed, redeemedAt: NOW })).toBe("invalid_grant");
  });
});

describe("page de revendication", () => {
  const reg = {
    status: "unclaimed" as const,
    claimExpiresAt: later(3600),
    attemptTokenHash: "h",
    attemptExpiresAt: later(300),
    deniedAt: null,
    claimedAt: null,
    redeemedAt: null,
    lastPolledAt: null,
    claimEmail: "jeanne@example.ch",
    attemptFailures: 0,
  };

  it("exige le bon compte, une tentative valide et peu d'échecs", () => {
    expect(checkClaimAttempt(reg, "Jeanne@Example.ch", NOW)).toBe("ok");
    expect(checkClaimAttempt(reg, "autre@example.ch", NOW)).toBe(
      "wrong_account",
    );
    expect(checkClaimAttempt({ ...reg, claimEmail: null }, "x@y.ch", NOW)).toBe(
      "ok",
    );
    expect(
      checkClaimAttempt(
        { ...reg, attemptFailures: MAX_CODE_FAILURES },
        reg.claimEmail,
        NOW,
      ),
    ).toBe("locked");
    expect(
      checkClaimAttempt(
        { ...reg, attemptExpiresAt: later(-1) },
        reg.claimEmail,
        NOW,
      ),
    ).toBe("expired");
    expect(
      checkClaimAttempt({ ...reg, status: "claimed" }, reg.claimEmail, NOW),
    ).toBe("already_claimed");
    expect(checkClaimAttempt(null, reg.claimEmail, NOW)).toBe("invalid");
  });
});

describe("ressources protégées (RFC 9728)", () => {
  it("publie un document par identifiant, resource identique à l'URL", () => {
    expect(protectedResources(ISSUER)).toEqual([
      `${ISSUER}/mcp/account`,
      ISSUER,
      `${ISSUER}/fr`,
      `${ISSUER}/de`,
      `${ISSUER}/it`,
      `${ISSUER}/en`,
    ]);
    for (const resource of protectedResources(ISSUER)) {
      const doc = protectedResourceMetadata(ISSUER, resource);
      expect(doc?.resource).toBe(resource);
      expect(doc?.authorization_servers).toEqual([ISSUER]);
      expect(doc?.bearer_methods_supported).toEqual(["header"]);
      expect(doc?.scopes_supported).toContain("orders.read");
    }
    expect(protectedResourceMetadata(ISSUER, `${ISSUER}/admin`)).toBeNull();
  });

  it("insère le chemin après /.well-known/oauth-protected-resource", () => {
    expect(protectedResourceMetadataUrl(ISSUER)).toBe(
      `${ISSUER}/.well-known/oauth-protected-resource`,
    );
    expect(protectedResourceMetadataUrl(`${ISSUER}/mcp/account`)).toBe(
      `${ISSUER}/.well-known/oauth-protected-resource/mcp/account`,
    );
    expect(protectedResourceMetadataUrl(`${ISSUER}/fr`)).toBe(
      `${ISSUER}/.well-known/oauth-protected-resource/fr`,
    );
  });

  it("construit les défis WWW-Authenticate", () => {
    const bare = bearerChallenge(ISSUER);
    expect(bare).toMatch(/^Bearer resource_metadata="/);
    expect(bare).toContain("/.well-known/oauth-protected-resource/mcp/account");
    expect(bare).not.toContain("error=");
    const scoped = bearerChallenge(ISSUER, {
      code: "insufficient_scope",
      description: 'needs "orders.read"',
      scope: ["orders.read"],
    });
    expect(scoped).toContain('error="insufficient_scope"');
    expect(scoped).toContain('scope="orders.read"');
    expect(scoped).toContain("error_description=\"needs 'orders.read'\"");
  });
});

describe("serveur MCP compte client", () => {
  const principal = (userId: string | null, scopes: string[]) => ({
    issuer: ISSUER,
    userId,
    clientId: "client",
    scopes: new Set(scopes),
  });
  const call = (name: string) => ({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: {} },
  });

  it("exige la portée de chaque outil compte", () => {
    expect(
      missingScope(call("list_my_orders"), principal("u1", ["orders.read"])),
    ).toBeNull();
    expect(missingScope(call("list_my_quotes"), principal("u1", []))).toBe(
      "quotes.read",
    );
    // Jeton d'agent anonyme : aucun outil compte, même avec la portée.
    expect(
      missingScope(call("list_my_orders"), principal(null, ["orders.read"])),
    ).toBe("orders.read");
    // Outils publics : aucune portée.
    expect(missingScope(call("search_products"), principal(null, []))).toBe(
      null,
    );
    expect(
      missingScope(
        [call("search_products"), call("get_my_order")],
        principal("u1", ["profile"]),
      ),
    ).toBe("orders.read");
  });

  it("ne liste que les outils autorisés", async () => {
    const dispatch = accountMcpDispatcher(principal("u1", ["orders.read"]), {});
    const { tools } = (await dispatch("tools/list", {})) as {
      tools: { name: string }[];
    };
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_my_orders");
    expect(names).toContain("get_my_order");
    expect(names).not.toContain("list_my_quotes");
    expect(names).toContain("search_products");
    expect(accountToolDefinitions(new Set(POST_CLAIM_SCOPES))).toHaveLength(
      ACCOUNT_TOOL_NAMES.length,
    );
  });
});

describe("/auth.md", () => {
  const doc = authMdDocument("https://swiss3design-preview.example.dev");

  it("respecte le profil auth.md", () => {
    expect(doc.split("\n")[0]).toMatch(/^# .*auth\.md/);
    expect(doc).toContain(JWT_BEARER_GRANT);
    expect(doc).toContain(CLAIM_GRANT);
    expect(doc).toContain('"type": "service_auth"');
    for (const tool of ACCOUNT_TOOL_NAMES) expect(doc).toContain(tool);
  });

  it("décrit les URL de l'environnement qui le sert", () => {
    expect(doc).toContain(
      "https://swiss3design-preview.example.dev/.well-known/oauth-protected-resource/mcp/account",
    );
    expect(doc).toContain(
      "https://swiss3design-preview.example.dev/api/auth/oauth2/authorize",
    );
    expect(doc).not.toContain("https://swiss3design.ch/api");
  });
});
