import { describe, it, expect } from "vitest";
import { createElement, Fragment } from "react";
import {
  alternatesFor,
  clampText,
  nodeText,
  pageMetadata,
  productJsonLd,
  siteJsonLd,
} from "./seo";

// Garde-fous des règles relevées par l'audit Ahrefs : un hreflang vers une
// redirection, un og:url absent ou un OnlineStore invalide repassent en
// erreur sur TOUTES les pages — ces tests les bloquent avant le déploiement.
describe("SEO — hreflang et canonical", () => {
  it("pointe chaque langue et x-default vers des URL préfixées (jamais « / »)", () => {
    const alt = alternatesFor("de", "/shop");
    expect(alt.canonical).toBe("/de/shop");
    expect(alt.languages).toEqual({
      fr: "/fr/shop",
      de: "/de/shop",
      it: "/it/shop",
      en: "/en/shop",
      "x-default": "/fr/shop",
    });
    // Aucune cible sans préfixe de langue (redirection 307 → erreur Ahrefs).
    for (const href of Object.values(alt.languages))
      expect(href).toMatch(/^\/(fr|de|it|en)(\/|$)/);
  });

  it("donne à chaque page un jeu Open Graph complet (og:url, image, locale)", () => {
    const meta = pageMetadata({
      locale: "it",
      path: "/contact",
      title: "Contatti",
      description: "x".repeat(120),
    });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.url).toBe("/it/contact");
    expect(og.title).toBe("Contatti · Swiss3Design");
    expect(og.locale).toBe("it_CH");
    expect(og.siteName).toBe("Swiss3Design");
    expect(Array.isArray(og.images) && og.images.length).toBe(1);
    expect(meta.alternates?.canonical).toBe("/it/contact");
  });

  it("n'ajoute pas la marque en double sur l'accueil (titre absolu)", () => {
    const meta = pageMetadata({
      locale: "fr",
      path: "",
      title: "Swiss3Design — Impression 3D multicolore en Suisse",
      description: "x".repeat(120),
      absoluteTitle: true,
    });
    expect(meta.title).toEqual({
      absolute: "Swiss3Design — Impression 3D multicolore en Suisse",
    });
  });
});

describe("SEO — textes", () => {
  it("coupe une description trop longue sur un mot, sans dépasser 158 signes", () => {
    const long = "Lorem ipsum dolor sit amet ".repeat(12);
    const out = clampText(long);
    expect(out.length).toBeLessThanOrEqual(158);
    expect(out.endsWith("…")).toBe(true);
    expect(clampText("  court   texte ")).toBe("court texte");
  });

  it("extrait le texte brut d'une réponse de FAQ en JSX", () => {
    const node = createElement(
      Fragment,
      null,
      "Envoyez votre fichier depuis la page ",
      createElement("a", { href: "/custom" }, "Sur mesure"),
      " : devis sous 48 h.",
    );
    expect(nodeText(node)).toBe(
      "Envoyez votre fichier depuis la page Sur mesure : devis sous 48 h.",
    );
  });
});

describe("SEO — données structurées", () => {
  it("n'utilise aucune propriété LocalBusiness sur l'OnlineStore", () => {
    const graph = siteJsonLd("fr", "Description")["@graph"];
    const store = graph.find((n) => n["@type"] === "OnlineStore");
    expect(store).toBeDefined();
    for (const key of ["currenciesAccepted", "priceRange", "openingHours"])
      expect(store).not.toHaveProperty(key);
  });

  it("décrit l'offre avec livraison CH, retours et port offert au-delà du seuil", () => {
    const base = {
      slug: "vase-spirale",
      name: "Vase spirale",
      description: "Vase",
      saleType: "on_demand" as const,
      productionDays: 3,
      stock: null,
      material: "PLA",
      weightGrams: 120,
      dimensionsMm: null,
      colors: ["Blanc"],
      imageUrls: ["/api/files/products/a.webp"],
    };
    const shipping = { shippingCents: 890, freeOverCents: 6000 };
    const cheap = productJsonLd({ ...base, priceCents: 2400 }, "fr", shipping);
    // À la demande = en stock + délai de production (MadeToOrder refusé par
    // Google pour les fiches marchandes).
    expect(cheap.offers.availability).toBe("https://schema.org/InStock");
    expect(
      cheap.offers.shippingDetails.deliveryTime.handlingTime.minValue,
    ).toBe(3);
    expect(cheap.offers.hasMerchantReturnPolicy.merchantReturnLink).toBe(
      "https://swiss3design.ch/fr/legal/shipping",
    );
    expect(
      productJsonLd({ ...base, priceCents: 2400, stock: 0 }, "fr", shipping)
        .offers.availability,
    ).toBe("https://schema.org/OutOfStock");
    expect(cheap.offers.shippingDetails.shippingRate.value).toBe("8.90");
    expect(
      cheap.offers.shippingDetails.shippingDestination.addressCountry,
    ).toBe("CH");
    expect(cheap.offers.hasMerchantReturnPolicy.merchantReturnDays).toBe(14);
    expect(cheap.image).toEqual([
      "https://swiss3design.ch/api/files/products/a.webp",
    ]);
    const pricey = productJsonLd({ ...base, priceCents: 9000 }, "fr", shipping);
    expect(pricey.offers.shippingDetails.shippingRate.value).toBe("0.00");
  });
});
