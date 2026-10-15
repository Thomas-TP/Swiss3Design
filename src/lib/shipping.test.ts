import { describe, it, expect } from "vitest";
import {
  shippingFor,
  shippingForOrder,
  SHIPPING_CENTS,
  FREE_SHIPPING_OVER_CENTS,
} from "./shipping";

describe("valeurs par défaut", () => {
  it("la livraison est offerte partout en Suisse, sans minimum", () => {
    expect(SHIPPING_CENTS).toBe(0);
    expect(FREE_SHIPPING_OVER_CENTS).toBe(0);
    expect(shippingFor(0)).toBe(0);
    expect(shippingFor(1)).toBe(0);
    expect(shippingFor(1_000_000)).toBe(0);
  });
});

describe("shippingFor (réglages de l'admin)", () => {
  const rule = { shippingCents: 890, freeOverCents: 6000 };

  it("facture le tarif unique sous le seuil", () => {
    expect(shippingFor(0, rule)).toBe(890);
    expect(shippingFor(5999, rule)).toBe(890);
  });

  it("offre la livraison au seuil et au-delà", () => {
    expect(shippingFor(6000, rule)).toBe(0);
    expect(shippingFor(16_000, rule)).toBe(0);
  });
});

describe("shippingForOrder : les objets du Studio ne portent jamais de port", () => {
  const rule = { shippingCents: 890, freeOverCents: 6000 };

  it("un panier du Studio seul n'a aucun port, même avec des réglages non nuls", () => {
    expect(shippingForOrder({ shopCents: 0, studioCents: 4490 }, rule)).toBe(0);
  });

  it("un panier mixte : le port ne dépend que de la part boutique", () => {
    expect(shippingForOrder({ shopCents: 2000, studioCents: 4490 }, rule)).toBe(
      890,
    );
    expect(shippingForOrder({ shopCents: 6000, studioCents: 100 }, rule)).toBe(
      0,
    );
  });

  it("un panier boutique seul suit les réglages", () => {
    expect(shippingForOrder({ shopCents: 2000, studioCents: 0 }, rule)).toBe(
      890,
    );
  });

  it("avec les défauts (0), tout est offert", () => {
    expect(shippingForOrder({ shopCents: 2000, studioCents: 4490 })).toBe(0);
  });
});
