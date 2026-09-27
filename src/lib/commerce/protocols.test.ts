import { describe, expect, it } from "vitest";
import { buildSellableSkus, skuIndex, type CatalogRows } from "./catalog";
import {
  buildQuote,
  CheckoutError,
  normalizeEmail,
  resolveLine,
  sptFailure,
  swissAddress,
} from "./checkout-core";
import {
  base64url,
  canonicalJson,
  challengeSecret,
  createChallenge,
  fromBase64url,
  parseCredential,
  receiptHeader,
  serializeChallenge,
  verifyChallenge,
} from "./mpp";
import {
  evaluate,
  sessionItems,
  type CatalogContext,
  type SessionRow,
  type SessionState,
} from "./agent-checkout";
import {
  acpDiscovery,
  acpSessionView,
  acpToken,
  acpComplete,
} from "./acp-protocol";
import {
  ucpCheckoutView,
  ucpProfile,
  ucpToken,
  ucpComplete,
} from "./ucp-protocol";

const rows: CatalogRows = {
  products: [
    {
      id: "p-vase",
      slug: "vase-spirale",
      priceCents: 2400,
      saleType: "on_demand",
      productionDays: 3,
      material: "PLA",
      dimensionsMm: null,
      weightGrams: null,
      model3dUrl: null,
      stock: null,
    },
    {
      id: "p-box",
      slug: "boite",
      priceCents: 4000,
      saleType: "stock",
      productionDays: null,
      material: "PLA",
      dimensionsMm: null,
      weightGrams: null,
      model3dUrl: null,
      stock: 2,
    },
  ],
  translations: [
    {
      productId: "p-vase",
      locale: "fr",
      name: "Vase spirale",
      description: "Vase.",
    },
    { productId: "p-box", locale: "fr", name: "Boîte", description: "Boîte." },
  ],
  images: [],
  variants: [],
  colors: [
    { productId: "p-vase", name: "Blanc", hex: "#fff" },
    { productId: "p-vase", name: "Noir", hex: "#000" },
  ],
  categories: [],
  ratings: [],
};
const skus = buildSellableSkus(rows);
const index = skuIndex(skus);
const rule = { shippingCents: 890, freeOverCents: 6000 };
const ctx: CatalogContext = { skus, index, rule };

describe("MPP — schéma Payment (méthode stripe)", () => {
  it("canonise le JSON (clés triées) comme mppx", () => {
    expect(canonicalJson({ b: 1, a: { d: "x", c: [2, 1] } })).toBe(
      '{"a":{"c":[2,1],"d":"x"},"b":1}',
    );
    expect(fromBase64url(base64url(new TextEncoder().encode("é✓")))).toBe("é✓");
  });

  it("émet un défi lié, puis reconnaît la preuve de paiement correspondante", async () => {
    const secret = await challengeSecret("sk_test_example");
    const challenge = await createChallenge(secret, {
      realm: "swiss3design.ch",
      method: "stripe",
      intent: "charge",
      request: {
        amount: "3290",
        currency: "chf",
        description: "Swiss3Design — 1 item(s)",
        externalId: "abc",
        methodDetails: { networkId: "profile_x", paymentMethodTypes: ["card"] },
      },
      description: "Swiss3Design — 1 item(s)",
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    const header = serializeChallenge(challenge);
    expect(header).toMatch(
      /^Payment id="[\w-]+", realm="swiss3design.ch", method="stripe", intent="charge", request="[\w-]+"/,
    );
    expect(header).toContain("\\u2014"); // tiret long échappé (en-tête Latin-1)

    // Preuve fabriquée comme mppx : challenge + payload, en base64url.
    const credential = `Payment ${base64url(
      new TextEncoder().encode(
        JSON.stringify({
          challenge: {
            ...challenge,
            request: base64url(
              new TextEncoder().encode(canonicalJson(challenge.request)),
            ),
          },
          payload: { spt: "spt_test_123" },
        }),
      ),
    )}`;
    const parsed = parseCredential(credential)!;
    expect(parsed.payload.spt).toBe("spt_test_123");
    expect(parsed.challenge.request.amount).toBe("3290");
    expect(
      await verifyChallenge(secret, parsed.challenge, "swiss3design.ch"),
    ).toBe("ok");

    // Montant altéré, autre domaine, défi expiré : refusés.
    expect(
      await verifyChallenge(
        secret,
        {
          ...parsed.challenge,
          request: { ...parsed.challenge.request, amount: "1" },
        },
        "swiss3design.ch",
      ),
    ).toBe("invalid");
    expect(
      await verifyChallenge(secret, parsed.challenge, "evil.example"),
    ).toBe("invalid");
    const expired = await createChallenge(secret, {
      ...challenge,
      expires: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await verifyChallenge(secret, expired, "swiss3design.ch")).toBe(
      "expired",
    );
  });

  it("ignore un en-tête sans schéma Payment et produit un reçu lisible", () => {
    expect(parseCredential("Bearer abc")).toBeNull();
    expect(parseCredential("Payment pas-du-base64")).toBeNull();
    const receipt = JSON.parse(fromBase64url(receiptHeader("pi_123", "ext")));
    expect(receipt).toMatchObject({
      method: "stripe",
      reference: "pi_123",
      status: "success",
      externalId: "ext",
    });
  });
});

describe("cœur du checkout des agents", () => {
  it("résout un article par SKU, ou par slug + couleur", () => {
    expect(
      resolveLine({ sku: "vase-spirale--noir" }, skus, index).colorName,
    ).toBe("Noir");
    expect(
      resolveLine({ slug: "vase-spirale", color: "blanc" }, skus, index).sku,
    ).toBe("vase-spirale--blanc");
    expect(() => resolveLine({ slug: "vase-spirale" }, skus, index)).toThrow(
      /colour/,
    );
    expect(() => resolveLine({ sku: "inconnu" }, skus, index)).toThrow(
      CheckoutError,
    );
  });

  it("chiffre comme le site et refuse ce qui n'est pas en stock", () => {
    const quote = buildQuote([{ sku: index.get("boite")!, quantity: 2 }], rule);
    expect([
      quote.subtotalCents,
      quote.shippingCents,
      quote.totalCents,
    ]).toEqual([8000, 0, 8000]);
    expect(() =>
      buildQuote([{ sku: index.get("boite")!, quantity: 3 }], rule),
    ).toThrow(/Only 2 left/);
    const small = buildQuote(
      [{ sku: index.get("vase-spirale--noir")!, quantity: 1 }],
      rule,
    );
    expect(small.totalCents).toBe(3290);
    expect(small.delivery).toEqual({ min: 4, max: 8 });
  });

  it("n'accepte qu'une adresse suisse complète et un e-mail valide", () => {
    expect(
      swissAddress({
        name: "Jean Dupont",
        street: "Rue du Lac 1",
        npa: "1260",
        city: "Nyon",
        canton: "vd",
      }),
    ).toEqual({
      name: "Jean Dupont",
      street: "Rue du Lac 1",
      npa: "1260",
      city: "Nyon",
      canton: "VD",
      country: "CH",
    });
    expect(() =>
      swissAddress({
        name: "X Y",
        street: "1 Main",
        npa: "75001",
        city: "Paris",
        country: "FR",
      }),
    ).toThrow(/Switzerland only/);
    expect(() =>
      swissAddress({ name: "X Y", street: "Rue 1", npa: "123", city: "Nyon" }),
    ).toThrow(/4 digits/);
    expect(normalizeEmail(" Client@Example.CH ")).toBe("client@example.ch");
    expect(() => normalizeEmail("pas-un-email")).toThrow(/valid email/);
  });

  it("ne libère le stock que sur un refus certain de Stripe", () => {
    expect(
      sptFailure({
        type: "StripeCardError",
        message: "Your card was declined.",
      }),
    ).toEqual({
      status: "failed",
      code: "payment_declined",
      message: "Your card was declined.",
    });
    expect(
      sptFailure({
        type: "StripeInvalidRequestError",
        message: "No such token",
      }),
    ).toMatchObject({ status: "failed", code: "payment_declined" });
    // Clé invalide : jamais recopiée dans la réponse à l'agent.
    const config = sptFailure({
      type: "StripeAuthenticationError",
      message: "Invalid API Key provided: sk_test_****",
    });
    expect(config).toMatchObject({ status: "failed", code: "unavailable" });
    expect(JSON.stringify(config)).not.toContain("sk_");
    // Réseau, 5xx, limite de débit, idempotence : Stripe a peut-être débité.
    for (const type of [
      "StripeConnectionError",
      "StripeAPIError",
      "StripeRateLimitError",
      "StripeIdempotencyError",
    ])
      expect(sptFailure({ type }).status).toBe("unknown");
    expect(sptFailure(new Error("fetch failed")).status).toBe("unknown");
    expect(sptFailure(null).status).toBe("unknown");
  });
});

function session(
  protocol: "acp" | "ucp",
  status: SessionRow["status"] = "open",
): SessionRow {
  const now = new Date();
  return {
    id: protocol === "acp" ? "cs_1" : "chk_1",
    protocol,
    status,
    state: {},
    orderId: null,
    agent: null,
    customerId: null,
    expiresAt: new Date(now.getTime() + 3600_000),
    createdAt: now,
    updatedAt: now,
  };
}

describe("sessions ACP/UCP", () => {
  const baseState: SessionState = {
    items: sessionItems([{ sku: "vase-spirale--noir", quantity: 1 }], ctx),
    buyer: {},
    address: null,
    locale: "fr",
  };

  it("reste incomplète tant qu'il manque l'e-mail ou l'adresse", () => {
    const ev = evaluate(baseState, ctx);
    expect(ev.ready).toBe(false);
    expect(ev.issues.map((i) => i.path)).toEqual([
      "$.buyer.email",
      "$.fulfillment",
    ]);
    const acp = acpSessionView(session("acp"), baseState, ev, {
      networkId: "profile_x",
      live: false,
    });
    expect(acp.status).toBe("not_ready_for_payment");
    expect(acp.capabilities.payment.handlers[0]).toMatchObject({
      name: "dev.acp.tokenized.card",
      psp: "stripe",
      config: { network_business_profile: "profile_x", environment: "test" },
    });
    const ucp = ucpCheckoutView(session("ucp"), baseState, ev, {
      origin: "https://swiss3design.ch",
      networkId: "profile_x",
      live: false,
    });
    expect(ucp.status).toBe("incomplete");
    expect(ucp.messages[0]).toMatchObject({
      type: "error",
      code: "missing",
      severity: "requires_buyer_input",
    });
  });

  it("devient payable avec acheteur et adresse suisse, totaux au centime", () => {
    const state: SessionState = {
      ...baseState,
      buyer: {
        email: "jean@example.ch",
        firstName: "Jean",
        lastName: "Dupont",
      },
      address: {
        name: "Jean Dupont",
        street: "Rue du Lac 1",
        npa: "1260",
        city: "Nyon",
      },
    };
    const ev = evaluate(state, ctx);
    expect(ev.ready).toBe(true);
    const acp = acpSessionView(session("acp"), state, ev, {
      networkId: "profile_x",
      live: true,
    });
    expect(acp.status).toBe("ready_for_payment");
    expect(acp.totals.find((t) => t.type === "total")?.amount).toBe(3290);
    expect(acp.fulfillment_options[0].totals[0].amount).toBe(890);
    const ucp = ucpCheckoutView(session("ucp"), state, ev, {
      origin: "https://swiss3design.ch",
      networkId: "profile_x",
      live: true,
    });
    expect(ucp.status).toBe("ready_for_complete");
    expect(ucp.line_items[0].item).toMatchObject({
      id: "vase-spirale--noir",
      price: 2400,
    });
    expect(ucp.fulfillment.methods[0].destinations[0]).toMatchObject({
      postal_code: "1260",
      address_country: "CH",
    });
  });

  it("lit le jeton de paiement dans les formats ACP (actuel et historique) et UCP", () => {
    expect(
      acpToken(
        acpComplete.parse({
          payment_data: {
            handler_id: "stripe_spt",
            instrument: { credential: { type: "spt", token: "spt_abc" } },
          },
        }),
      ),
    ).toBe("spt_abc");
    expect(
      acpToken(
        acpComplete.parse({
          payment_data: { token: "spt_old", provider: "stripe" },
        }),
      ),
    ).toBe("spt_old");
    expect(
      acpToken(acpComplete.parse({ payment_data: { token: "tok_visa" } })),
    ).toBeNull();
    expect(
      ucpToken(
        ucpComplete.parse({
          payment: {
            instruments: [
              {
                handler_id: "stripe_spt",
                credential: {
                  type: "stripe_shared_payment_token",
                  token: "spt_u",
                },
              },
            ],
          },
        }),
      ),
    ).toBe("spt_u");
  });

  it("publie des documents de découverte conformes", () => {
    expect(acpDiscovery("https://swiss3design.ch/api/acp")).toMatchObject({
      protocol: {
        name: "acp",
        version: "2026-04-17",
        supported_versions: ["2026-04-17"],
      },
      api_base_url: "https://swiss3design.ch/api/acp",
      transports: ["rest"],
      capabilities: { services: ["checkout"] },
    });
    const profile = ucpProfile({
      origin: "https://swiss3design.ch",
      networkId: "profile_x",
      live: true,
      keys: [{ kty: "OKP", crv: "Ed25519", x: "abc", kid: "k1" }],
    });
    expect(profile.ucp.version).toBe("2026-08-25");
    expect(profile.ucp.services["dev.ucp.shopping"][0]).toMatchObject({
      transport: "rest",
      endpoint: "https://swiss3design.ch/api/ucp",
    });
    expect(Object.keys(profile.ucp.payment_handlers)).toEqual([
      "ch.swiss3design.stripe_spt",
    ]);
    expect(Object.keys(profile.ucp.payment_handlers)[0]).toMatch(
      /^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_-]*[a-z0-9_])?)+$/,
    );
  });
});
