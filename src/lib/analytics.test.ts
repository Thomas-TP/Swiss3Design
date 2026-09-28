import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult, PostHog } from "posthog-js";
import {
  attachPostHog,
  cartProperties,
  chf,
  posthogConfig,
  productProperties,
  sanitizeEvent,
  sanitizeUrl,
  track,
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

  it("retire le fragment de configuration du Studio (#c=)", () => {
    expect(
      sanitizeUrl("https://swiss3design.ch/fr/studio/lavaux#c=v1.eyJoIjoxNTB9"),
    ).toBe("https://swiss3design.ch/fr/studio/lavaux");
    expect(sanitizeUrl("/de/studio/relief#c=v1.e30")).toBe("/de/studio/relief");
    expect(sanitizeUrl("/fr/studio/borne#vue=plan&c=v1.e30")).toBe(
      "/fr/studio/borne",
    );
    // Avec une requête : la liste blanche s'applique toujours.
    expect(
      sanitizeUrl(
        "https://swiss3design.ch/fr/studio/lavaux?utm_source=chatgpt.com&h=150#c=v1.e30",
      ),
    ).toBe("https://swiss3design.ch/fr/studio/lavaux?utm_source=chatgpt.com");
  });

  it("garde les autres ancres (#studio de /custom, sections)", () => {
    expect(sanitizeUrl("/fr/custom#studio")).toBe("/fr/custom#studio");
    expect(sanitizeUrl("/fr/a-propos#abc=1")).toBe("/fr/a-propos#abc=1");
    expect(sanitizeUrl("/fr/shop?q=vase&x=1#grille")).toBe(
      "/fr/shop?q=vase#grille",
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

  it("retire #c= des URL capturées et des liens cliqués", () => {
    const out = sanitizeEvent(
      event(
        {
          $pathname: "/fr/studio/lavaux",
          $current_url: "https://swiss3design.ch/fr/studio/lavaux#c=v1.e30",
          $elements: [
            { tag_name: "a", attr__href: "/fr/studio/lavaux#c=v1.e30" },
          ],
          $elements_chain:
            'a:attr__href="/fr/studio/lavaux#c=v1.e30"href="/fr/studio/lavaux#c=v1.e30"',
        },
        { event: "$autocapture" },
      ),
    );
    expect(out?.properties).toMatchObject({
      $current_url: "https://swiss3design.ch/fr/studio/lavaux",
      $elements: [{ tag_name: "a", attr__href: "/fr/studio/lavaux" }],
      $elements_chain:
        'a:attr__href="/fr/studio/lavaux"href="/fr/studio/lavaux"',
    });
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

describe("posthogConfig", () => {
  afterEach(() => vi.unstubAllGlobals());
  // posthogConfig lit la géolocalisation posée sur <html> par le layout.
  const config = () => {
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    return posthogConfig();
  };

  it("n'enregistre jamais le contenu ni les en-têtes des requêtes réseau", () => {
    expect(config().session_recording).toMatchObject({
      maskAllInputs: true,
      recordBody: false,
      recordHeaders: false,
    });
  });

  // Échoue dès qu'une mise à jour de posthog-js apporte un nouveau millésime :
  // relire ce qu'il change (doc de `defaults` dans @posthog/types,
  // posthog-config.d.ts), puis monter `defaults` dans analytics.ts.
  it("suit le dernier millésime de `defaults` de posthog-js", () => {
    const types = readFileSync(
      join(
        process.cwd(),
        "node_modules/@posthog/types/dist/posthog-config.d.ts",
      ),
      "utf8",
    );
    const union = types.match(/type ConfigDefaults = ([^;]+);/)?.[1] ?? "";
    const latest = Array.from(
      union.matchAll(/'(\d{4}-\d{2}-\d{2})'/g),
      (match) => match[1],
    )
      .sort()
      .at(-1);
    expect(latest).toBeDefined();
    expect(config().defaults).toBe(latest);
  });
});

describe("Quote Requested (§4.10)", () => {
  // Client PostHog factice : attachPostHog vide la file et reçoit la suite.
  const capture = vi.fn<(event: string, properties?: object) => void>();
  attachPostHog({ capture } as unknown as PostHog);
  afterEach(() => capture.mockClear());

  it("l'ancien formulaire garde ses propriétés et gagne source « form »", () => {
    track("Quote Requested", {
      material: "PLA",
      has_file: true,
      signed_in: false,
    });
    expect(capture).toHaveBeenCalledWith("Quote Requested", {
      source: "form",
      material: "PLA",
      has_file: true,
      signed_in: false,
    });
  });

  it("le Studio passe source « studio » et l'objet", () => {
    track("Quote Requested", {
      material: "PLA",
      has_file: true,
      signed_in: true,
      source: "studio",
      object: "lavaux",
    });
    expect(capture).toHaveBeenCalledWith(
      "Quote Requested",
      expect.objectContaining({ source: "studio", object: "lavaux" }),
    );
  });

  it("contrat vérifié à la compilation (tsc lit aussi ce fichier)", () => {
    track("Quote Requested", {
      has_file: false,
      signed_in: false,
      // @ts-expect-error source hors de « form » | « studio »
      source: "mail",
    });
    // @ts-expect-error objet inconnu du Studio
    track("Studio Viewed", { object: "vase-spirale" });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("les autres événements partent tels quels", () => {
    track("Cart Viewed", { value: 34.9 });
    track("Page Not Found");
    expect(capture).toHaveBeenNthCalledWith(1, "Cart Viewed", { value: 34.9 });
    expect(capture).toHaveBeenNthCalledWith(2, "Page Not Found", undefined);
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
