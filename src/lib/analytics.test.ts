import { describe, expect, it } from "vitest";
import type { CaptureResult } from "posthog-js";
import {
  cartProperties,
  chf,
  productProperties,
  sanitizeEvent,
  sanitizeUrl,
} from "./analytics";

const event = (
  properties: Record<string, unknown>,
  extra: Partial<CaptureResult> = {},
) =>
  ({
    uuid: "0",
    event: "$pageview",
    properties,
    ...extra,
  }) as CaptureResult;

describe("sanitizeUrl", () => {
  it("garde campagnes, recherche et filtres, retire le reste", () => {
    expect(
      sanitizeUrl(
        "https://swiss3design.ch/fr/shop?q=vase&utm_source=chatgpt.com&session_id=cs_live_123&email=a%40b.ch",
      ),
    ).toBe("https://swiss3design.ch/fr/shop?q=vase&utm_source=chatgpt.com");
  });

  it("garde les marqueurs de provenance (IA, Google Shopping, régies)", () => {
    expect(
      sanitizeUrl(
        "https://swiss3design.ch/fr?utm_source=chatgpt.com&srsltid=AfmBOo&gad_source=1&token=secret",
      ),
    ).toBe(
      "https://swiss3design.ch/fr?utm_source=chatgpt.com&srsltid=AfmBOo&gad_source=1",
    );
  });

  it("vide complètement la requête de la confirmation Stripe", () => {
    expect(
      sanitizeUrl(
        "https://swiss3design.ch/fr/checkout/success?session_id=cs_live_1",
      ),
    ).toBe("https://swiss3design.ch/fr/checkout/success");
  });

  it("traite aussi les liens relatifs (href capturés)", () => {
    expect(sanitizeUrl("/fr/account/register?email=a%40b.ch")).toBe(
      "/fr/account/register",
    );
    expect(sanitizeUrl("/fr/track?order=S3D-1042")).toBe("/fr/track");
  });

  it("laisse intactes les URL sans paramètre", () => {
    expect(sanitizeUrl("https://chatgpt.com/")).toBe("https://chatgpt.com/");
    expect(sanitizeUrl("/fr/products/vase-spirale")).toBe(
      "/fr/products/vase-spirale",
    );
  });
});

describe("sanitizeEvent", () => {
  it("n'envoie jamais rien depuis l'admin", () => {
    expect(sanitizeEvent(event({ $pathname: "/fr/admin/orders" }))).toBeNull();
    expect(sanitizeEvent(event({ $pathname: "/de/admin" }))).toBeNull();
    expect(
      sanitizeEvent(event({ $pathname: "/fr/administration" })),
    ).not.toBeNull();
  });

  it("épure les URL et masque les adresses e-mail", () => {
    const out = sanitizeEvent(
      event({
        $pathname: "/fr/checkout/success",
        $current_url:
          "https://swiss3design.ch/fr/checkout/success?session_id=cs_1",
        $referrer: "https://swiss3design.ch/fr/checkout?email=a%40b.ch",
        $el_text: "Connecté : jean.dupont@example.ch",
      }),
    );
    expect(out?.properties).toMatchObject({
      $current_url: "https://swiss3design.ch/fr/checkout/success",
      $referrer: "https://swiss3design.ch/fr/checkout",
      $el_text: "Connecté : [email]",
    });
  });

  it("nettoie les liens cliqués de l'autocapture", () => {
    const out = sanitizeEvent(
      event(
        {
          $pathname: "/fr/checkout/success",
          $elements: [
            {
              tag_name: "a",
              attr__href: "/fr/account/register?email=a%40b.ch",
            },
          ],
          $elements_chain:
            'a:attr__href="/fr/track?order=S3D-1"href="/fr/track?order=S3D-1"',
        },
        { event: "$autocapture" },
      ),
    );
    expect(out?.properties?.$elements).toEqual([
      { tag_name: "a", attr__href: "/fr/account/register" },
    ]);
    expect(out?.properties?.$elements_chain).toBe(
      'a:attr__href="/fr/track"href="/fr/track"',
    );
  });

  it("nettoie aussi $set et laisse passer les enregistrements", () => {
    const withSet = sanitizeEvent(
      event(
        { $pathname: "/fr" },
        {
          $set: {
            $initial_current_url: "https://swiss3design.ch/?email=x@y.ch",
          },
        },
      ),
    );
    expect(withSet?.$set).toEqual({
      $initial_current_url: "https://swiss3design.ch/",
    });
    const snapshot = event(
      { $snapshot_data: [{ x: "a@b.ch" }] },
      {
        event: "$snapshot",
      },
    );
    expect(sanitizeEvent(snapshot)).toBe(snapshot);
  });
});

describe("propriétés e-commerce", () => {
  const item = {
    productId: "p1",
    slug: "vase-spirale",
    name: "Vase spirale",
    priceCents: 3490,
    variantName: null,
    colorName: "Blanc",
    colorHex: "#fff",
    imageUrl: null,
    saleType: "on_demand" as const,
    quantity: 2,
  };

  it("exprime les montants en francs, devise explicite", () => {
    expect(chf(3490)).toBe(34.9);
    expect(productProperties(item)).toMatchObject({
      product_id: "p1",
      sku: "vase-spirale",
      price: 34.9,
      quantity: 2,
      currency: "CHF",
      variant: "Blanc",
    });
  });

  it("résume le panier (valeur et quantité totales)", () => {
    expect(cartProperties([item])).toMatchObject({
      value: 69.8,
      quantity: 2,
      currency: "CHF",
    });
  });
});
