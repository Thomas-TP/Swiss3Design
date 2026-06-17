import { describe, it, expect } from "vitest";
import {
  shippingFor,
  SHIPPING_CENTS,
  FREE_SHIPPING_OVER_CENTS,
} from "./shipping";

describe("shippingFor", () => {
  it("facture le tarif unique sous le seuil", () => {
    expect(shippingFor(0)).toBe(SHIPPING_CENTS);
    expect(shippingFor(FREE_SHIPPING_OVER_CENTS - 1)).toBe(SHIPPING_CENTS);
  });

  it("offre la livraison au seuil et au-delà", () => {
    expect(shippingFor(FREE_SHIPPING_OVER_CENTS)).toBe(0);
    expect(shippingFor(FREE_SHIPPING_OVER_CENTS + 10_000)).toBe(0);
  });
});
