import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  buildSellableSkus,
  feedImageUrl,
  feedSkuId,
  skuIndex,
  type CatalogRows,
} from "./catalog";
import { buildFeed, dimensionsCm, productFeedRow, toCsv } from "./feed";
import {
  agenticOrderDraft,
  customizeShipping,
  decideFinalize,
  priceAvailability,
} from "./acs";
import { isUniqueViolation, localeFromNpa } from "./agent-orders";

const rule = { shippingCents: 890, freeOverCents: 6000 };

const rows: CatalogRows = {
  products: [
    {
      id: "p-vase",
      slug: "vase-spirale",
      priceCents: 2400,
      saleType: "on_demand",
      productionDays: 3,
      material: "PLA",
      dimensionsMm: "90 x 90 x 210",
      weightGrams: 120,
      model3dUrl: null,
      stock: null,
    },
    {
      id: "p-lamp",
      slug: "lampe",
      priceCents: 5900,
      saleType: "stock",
      productionDays: null,
      material: "PETG",
      dimensionsMm: null,
      weightGrams: null,
      model3dUrl: "/api/files/models/lampe.glb",
      stock: 3,
    },
    {
      id: "p-box",
      slug: "boite",
      priceCents: 1500,
      saleType: "stock",
      productionDays: null,
      material: "PLA",
      dimensionsMm: null,
      weightGrams: null,
      model3dUrl: null,
      stock: 1,
    },
  ],
  translations: [
    {
      productId: "p-vase",
      locale: "fr",
      name: "Vase spirale",
      description: "Vase **torsadé**,\nétanche.",
    },
    {
      productId: "p-vase",
      locale: "en",
      name: "Spiral vase",
      description: "x",
    },
    { productId: "p-lamp", locale: "fr", name: "Lampe", description: "Lampe." },
    { productId: "p-box", locale: "fr", name: "Boîte", description: "Boîte." },
  ],
  images: [
    { productId: "p-vase", url: "/api/files/products/a.webp" },
    { productId: "p-vase", url: "/api/files/products/b,c.webp" },
  ],
  variants: [
    {
      id: "v1",
      productId: "p-lamp",
      sku: "LAMPE-S",
      name: "Petite",
      priceCents: null,
      stock: 2,
    },
    {
      id: "v2",
      productId: "p-lamp",
      sku: "LAMPE-L",
      name: "Grande",
      priceCents: 7900,
      stock: 0,
    },
  ],
  colors: [
    { productId: "p-vase", name: "Blanc", hex: "#ffffff" },
    { productId: "p-vase", name: "Noir", hex: "#000000" },
    { productId: "p-box", name: "Rouge brique", hex: "#aa3322" },
  ],
  categories: [{ productId: "p-vase", name: "Décoration" }],
  ratings: [{ productId: "p-vase", count: 4, average: 4.75 }],
};

const skus = buildSellableSkus(rows);
const index = skuIndex(skus);

describe("catalogue vendable (SKU)", () => {
  it("décline produit × variante × couleur avec des SKU stables", () => {
    expect(skus.map((s) => s.sku)).toEqual([
      "vase-spirale--blanc",
      "vase-spirale--noir",
      "LAMPE-S",
      "LAMPE-L",
      "boite--rouge-brique",
    ]);
    const blanc = index.get("vase-spirale--blanc")!;
    expect(blanc.groupId).toBe("vase-spirale");
    expect(blanc.title).toBe("Vase spirale — Blanc");
    expect(blanc.description).toBe("Vase torsadé, étanche.");
    // Les couleurs partagent le stock de la fiche.
    expect(blanc.stockKey).toBe(index.get("vase-spirale--noir")!.stockKey);
    expect(index.get("LAMPE-L")!.priceCents).toBe(7900);
    expect(index.get("LAMPE-S")!.priceCents).toBe(5900);
    expect(index.get("LAMPE-S")!.lineName).toBe("Lampe — Petite");
    // Une seule déclinaison : pas de groupe.
    expect(index.get("boite--rouge-brique")!.groupId).toBeNull();
  });

  it("borne l'identifiant à 100 caractères, suffixe couleur compris", () => {
    const id = feedSkuId("x".repeat(99), "Noir");
    expect(id).toHaveLength(100);
    expect(id.endsWith("--noir")).toBe(true);
  });

  it("sert les photos en JPEG via la transformation d'images Cloudflare", () => {
    expect(feedImageUrl("/api/files/products/a.webp")).toBe(
      "https://swiss3design.ch/cdn-cgi/image/format=jpeg,width=1200,fit=scale-down,quality=85/api/files/products/a.webp",
    );
  });
});

describe("flux CSV Stripe", () => {
  it("échappe virgules, guillemets et retours à la ligne (RFC 4180)", () => {
    expect(toCsv(["a", "b"], [{ a: 'dit "oui", ok', b: "x\ny" }])).toBe(
      'a,b\r\n"dit ""oui"", ok","x\ny"\r\n',
    );
  });

  it("déclare port, seuil de gratuité, taxe et stock non suivi", () => {
    const row = productFeedRow(index.get("vase-spirale--noir")!, rule);
    expect(row.price).toBe("24.00 CHF");
    // Impression à la demande (3 j) : préparation 3–5 j + acheminement 1–3 j.
    expect(row.shipping).toBe("CH:ALL:Poste suisse:4-8:8.90 CHF");
    expect(row.free_shipping_threshold).toBe("CH:ALL:Poste suisse:60.00 CHF");
    expect(row.inventory_not_tracked).toBe("true");
    expect(row.inventory_quantity).toBeNull();
    expect(row.availability).toBe("in_stock");
    expect(row.stripe_product_tax_code).toBe("txcd_99999999");
    expect(row.additional_image_link).toContain("b%2Cc.webp");
    expect(row.product_review_rating).toBe("4.8");
    expect(row.length).toBe("9 cm");
    expect(row.height).toBe("21 cm");
    expect(row.product_warning.startsWith("legal_disclaimer:")).toBe(true);
    expect(row.product_warning.slice(17)).not.toMatch(/[,:]/);
  });

  it("met en rupture un SKU suivi à zéro et publie son 3D en absolu", () => {
    const row = productFeedRow(index.get("LAMPE-L")!, rule);
    expect(row.availability).toBe("out_of_stock");
    expect(row.inventory_quantity).toBe(0);
    expect(row.model_3d_link).toBe(
      "https://swiss3design.ch/api/files/models/lampe.glb",
    );
  });

  it("ne met que les SKU suivis dans le flux stock", () => {
    const { csv, rows: count } = buildFeed("inventory", skus, rule);
    expect(count).toBe(3);
    expect(csv).not.toContain("vase-spirale");
    expect(csv).toContain("LAMPE-L,out_of_stock,0");
  });

  it("lit les dimensions en millimètres", () => {
    expect(dimensionsCm("120×81 x 45")).toEqual({
      length: "12 cm",
      width: "8.1 cm",
      height: "4.5 cm",
    });
    expect(dimensionsCm("environ 20 cm")).toBeNull();
  });
});

describe("hook de validation (finalize_checkout)", () => {
  const base = {
    currency: "chf",
    shipping_details: { address: { country: "CH" } },
  };

  it("accepte une commande conforme au site", () => {
    expect(
      decideFinalize(
        {
          ...base,
          amount_total: 2400 + 890,
          line_item_details: [
            { sku_id: "vase-spirale--noir", unit_amount: 2400, quantity: 1 },
          ],
          total_details: { amount_shipping: 890 },
        },
        index,
        rule,
      ),
    ).toEqual({ approved: true });
  });

  it("offre le port dès le seuil", () => {
    expect(
      decideFinalize(
        {
          ...base,
          amount_total: 7200,
          line_item_details: [
            { sku_id: "vase-spirale--noir", unit_amount: 2400, quantity: 3 },
          ],
          total_details: { amount_shipping: 0 },
        },
        index,
        rule,
      ).approved,
    ).toBe(true);
  });

  it("refuse hors de Suisse, prix changé, stock insuffisant ou port faux", () => {
    const line = { sku_id: "LAMPE-S", unit_amount: 5900, quantity: 1 };
    expect(
      decideFinalize(
        {
          ...base,
          shipping_details: { address: { country: "FR" } },
          line_item_details: [line],
        },
        index,
        rule,
      ).approved,
    ).toBe(false);
    expect(
      decideFinalize(
        { ...base, line_item_details: [{ ...line, unit_amount: 5000 }] },
        index,
        rule,
      ).approved,
    ).toBe(false);
    expect(
      decideFinalize(
        { ...base, line_item_details: [{ ...line, quantity: 3 }] },
        index,
        rule,
      ).approved,
    ).toBe(false);
    expect(
      decideFinalize(
        {
          ...base,
          line_item_details: [line],
          total_details: { amount_shipping: 0 },
        },
        index,
        rule,
      ).approved,
    ).toBe(false);
    expect(
      decideFinalize(
        { ...base, currency: "eur", line_item_details: [line] },
        index,
        rule,
      ).approved,
    ).toBe(false);
  });
});

describe("hooks livraison et disponibilité", () => {
  it("calcule le port comme le site, délai de la pièce la plus lente", () => {
    const small = customizeShipping(
      {
        currency: "chf",
        line_item_details: [
          { sku_id: "vase-spirale--blanc", unit_amount: 2400, quantity: 1 },
        ],
      },
      index,
      rule,
    );
    const option = small.shipping_options[0].shipping_rate_data;
    expect(option.fixed_amount).toEqual({ amount: 890, currency: "chf" });
    expect(option.delivery_estimate.maximum.value).toBe(8);
    const big = customizeShipping(
      {
        currency: "chf",
        line_item_details: [
          { sku_id: "LAMPE-S", unit_amount: 5900, quantity: 2 },
        ],
      },
      index,
      rule,
    );
    expect(big.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(
      0,
    );
  });

  it("renvoie prix et stock en temps réel, ou la suppression", () => {
    expect(priceAvailability("LAMPE-S", "acct_1", index)).toMatchObject({
      availability: { status: "in_stock", quantity: 2 },
      price: { unit_amount: 5900, currency: "chf" },
    });
    const sold = priceAvailability("LAMPE-L", "acct_1", index);
    expect(sold).toMatchObject({ availability: { status: "out_of_stock" } });
    expect("price" in sold).toBe(false);
    expect(priceAvailability("inconnu", "acct_1", index)).toEqual({
      sku_id: "inconnu",
      merchant_id: "acct_1",
      deleted: true,
    });
  });
});

function session(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    currency: "chf",
    amount_total: 3290,
    amount_subtotal: 2400,
    payment_status: "paid",
    payment_intent: "pi_1",
    locale: null,
    metadata: {},
    customer_details: { email: "Client@Example.ch", name: "Jean" },
    total_details: { amount_discount: 0, amount_shipping: 890, amount_tax: 0 },
    collected_information: {
      shipping_details: {
        name: "Jean Dupont",
        address: {
          line1: "Rue du Lac 1",
          line2: "App. 3",
          city: "Nyon",
          postal_code: "1260",
          state: "vd",
          country: "CH",
        },
      },
    },
    line_items: {
      object: "list",
      has_more: false,
      url: "",
      data: [
        {
          id: "li_1",
          quantity: 1,
          description: "Vase spirale — Noir",
          amount_subtotal: 2400,
          price: {
            unit_amount: 2400,
            external_reference: "vase-spirale--noir",
          },
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe("vente Stripe Agentic Commerce → commande", () => {
  it("reconstitue la commande depuis la session payée", () => {
    const draft = agenticOrderDraft(session(), index)!;
    expect(draft.channel).toBe("stripe_acs");
    expect(draft.email).toBe("client@example.ch");
    expect(draft.locale).toBe("fr");
    expect(draft.address).toEqual({
      name: "Jean Dupont",
      street: "Rue du Lac 1, App. 3",
      npa: "1260",
      city: "Nyon",
      canton: "VD",
      country: "CH",
    });
    expect(draft.lines[0]).toMatchObject({
      skuId: "vase-spirale--noir",
      name: "Vase spirale",
      colorName: "Noir",
      unitCents: 2400,
      quantity: 1,
    });
    expect([
      draft.subtotalCents,
      draft.shippingCents,
      draft.totalCents,
    ]).toEqual([2400, 890, 3290]);
    expect(draft.paymentIntentId).toBe("pi_1");
    expect(draft.notes).toEqual([]);
  });

  it("ignore une session sans SKU de notre flux (lien de paiement manuel)", () => {
    const manual = session({
      line_items: {
        object: "list",
        has_more: false,
        url: "",
        data: [
          {
            id: "li_2",
            quantity: 1,
            amount_subtotal: 1000,
            price: { unit_amount: 1000 },
          },
        ],
      } as unknown as Stripe.Checkout.Session["line_items"],
    });
    expect(agenticOrderDraft(manual, index)).toBeNull();
  });

  it("n'échoue jamais : SKU inconnu et adresse étrangère deviennent des alertes", () => {
    const odd = session({
      collected_information: {
        shipping_details: {
          name: "X",
          address: {
            line1: "1 Main St",
            line2: null,
            city: "Paris",
            postal_code: "75001",
            state: null,
            country: "FR",
          },
        },
      } as Stripe.Checkout.Session["collected_information"],
      line_items: {
        object: "list",
        has_more: false,
        url: "",
        data: [
          {
            id: "li_3",
            quantity: 2,
            description: "Objet retiré",
            amount_subtotal: 1200,
            price: { unit_amount: 600, external_reference: "retire" },
          },
        ],
      } as unknown as Stripe.Checkout.Session["line_items"],
      amount_total: 2090,
    });
    const draft = agenticOrderDraft(odd, index)!;
    expect(draft.lines[0]).toMatchObject({
      sku: null,
      name: "Objet retiré",
      quantity: 2,
    });
    expect(draft.notes.join("\n")).toContain("hors de Suisse (FR)");
    expect(draft.notes.join("\n")).toContain("Article inconnu");
    expect(draft.totalCents).toBe(
      draft.subtotalCents + draft.shippingCents - draft.discountCents,
    );
  });

  it("refuse une devise autre que le franc", () => {
    expect(() =>
      agenticOrderDraft(session({ currency: "eur" }), index),
    ).toThrow("agentic_currency_unsupported");
  });
});

describe("utilitaires des commandes d'agents", () => {
  it("devine la langue par région de NPA", () => {
    expect(localeFromNpa("6900")).toBe("it");
    expect(localeFromNpa("1196")).toBe("fr");
    expect(localeFromNpa("8001")).toBe("de");
    expect(localeFromNpa("")).toBe("fr");
  });

  it("reconnaît une violation d'unicité enveloppée par Drizzle", () => {
    expect(
      isUniqueViolation(
        new Error("Failed query", { cause: { code: "23505" } }),
      ),
    ).toBe(true);
    expect(isUniqueViolation(new Error("autre"))).toBe(false);
  });
});
