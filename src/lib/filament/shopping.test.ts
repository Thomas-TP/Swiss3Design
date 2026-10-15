import { describe, expect, it } from "vitest";
import {
  planBasket,
  priceBasket,
  suggestPurchases,
  tierPercent,
  type BasketLine,
  type BuyRefInput,
} from "./shopping";

const ref = (id: string, over: Partial<BuyRefInput> = {}): BuyRefInput => ({
  refId: id,
  label: id,
  studio: true,
  customOk: true,
  available: 1000,
  orderedGrams: 0,
  sealed: 1,
  ordered: 0,
  reorderBelowGrams: 300,
  minSpareSpools: 1,
  priceSpoolEurCents: null,
  priceRefillEurCents: 1699,
  urlSpool: null,
  urlRefill: `https://eu.store/${id}`,
  ...over,
});

describe("suggestPurchases : seuil et réserve", () => {
  it("rien à acheter quand le stock et la réserve suffisent", () => {
    expect(suggestPurchases([ref("a")])).toEqual([]);
  });
  it("sous le seuil de 300 g disponibles : une bobine", () => {
    const [s] = suggestPurchases([
      ref("a", { available: 250, sealed: 1, minSpareSpools: 1 }),
    ]);
    expect(s).toMatchObject({ refId: "a", qty: 1, reason: "below" });
  });
  it("aucune bobine neuve de réserve : une bobine", () => {
    const [s] = suggestPurchases([ref("a", { available: 400, sealed: 0 })]);
    expect(s).toMatchObject({ qty: 1, reason: "spare" });
  });
  it("compte ce qui est déjà commandé (grammes et bobines)", () => {
    expect(
      suggestPurchases([
        ref("a", { available: 50, sealed: 0, ordered: 1, orderedGrams: 1000 }),
      ]),
    ).toEqual([]);
  });
  it("les plus urgentes d'abord (jours de couverture, puis disponible)", () => {
    const out = suggestPurchases([
      ref("lent", { available: 100, sealed: 0, gramsPerDay: 1 }),
      ref("vite", { available: 100, sealed: 0, gramsPerDay: 50 }),
      ref("inconnu", { available: 20, sealed: 0 }),
    ]);
    expect(out.map((s) => s.refId)).toEqual(["vite", "lent", "inconnu"]);
  });
});

describe("priceBasket : paliers, port offert dès 119 €", () => {
  const line = (qty: number, unit = 1699): BasketLine => ({
    refId: "x",
    format: "refill",
    qty,
    unitEurCents: unit,
    url: null,
    extra: false,
    needsHolder: false,
  });
  it("paliers −10 / −20 / −30 / −40 % à 2 / 4 / 6 / 10", () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 15].map((n) => tierPercent(n))).toEqual([
      0, 10, 10, 20, 20, 30, 30, 40, 40,
    ]);
  });
  it("une unité : plein tarif et 20 € de port", () => {
    const t = priceBasket([line(1)]);
    expect(t).toMatchObject({
      tierPercent: 0,
      listEurCents: 1699,
      shippingEurCents: 2000,
      totalEurCents: 3699,
    });
  });
  it("dix recharges à −40 % : 101,94 €, encore 17,06 € pour le port offert", () => {
    const t = priceBasket([line(10)]);
    expect(t.discountEurCents).toBe(6796);
    expect(t.shippingEurCents).toBe(2000);
    expect(t.totalEurCents).toBe(10194 + 2000);
    expect(t.freeShippingGapEurCents).toBe(1706);
  });
  it("quinze recharges : 152,91 € après remise, port offert", () => {
    const t = priceBasket([line(15)]);
    expect(t.totalEurCents).toBe(15291);
    expect(t.shippingEurCents).toBe(0);
    expect(t.freeShippingGapEurCents).toBe(0);
  });
  it("le port offert se juge après remise", () => {
    // 8 × 19,99 = 159,92 € ; −30 % = 111,94 € < 119 € : port payant.
    const t = priceBasket([line(8, 1999)]);
    expect(t.totalEurCents).toBe(11194 + 2000);
    expect(t.freeShippingGapEurCents).toBe(11900 - 11194);
  });
  it("panier vide : zéro", () => {
    expect(priceBasket([])).toMatchObject({ units: 0, totalEurCents: 0 });
  });
});

describe("planBasket : recharge ou bobine, extras jusqu'au palier", () => {
  const refs = [
    ref("white", { priceSpoolEurCents: 1999 }),
    ref("red", { priceSpoolEurCents: 1999 }),
    ref("green"),
    ref("ice"),
    ref("latte"),
    ref("terra"),
    ref("pink"),
    ref("moss"),
    ref("sand"),
    ref("rust"),
    ref("sky"),
  ];
  const need = (refId: string, qty = 1) => ({
    refId,
    qty,
    reason: "below" as const,
    coverDays: null,
  });

  it("une recharge seulement s'il reste un support vide, sinon une bobine", () => {
    const plan = planBasket(refs, [need("white", 3)], [], 2);
    const lines = plan.options[0].lines;
    expect(lines.find((l) => l.format === "refill")?.qty).toBe(2);
    expect(lines.find((l) => l.format === "spool")?.qty).toBe(1);
  });

  it("une couleur sans format avec bobine reste en recharge, marquée « support requis »", () => {
    const plan = planBasket(refs, [need("green")], [], 0);
    expect(plan.options[0].lines[0]).toMatchObject({
      format: "refill",
      needsHolder: true,
    });
  });

  it("propose les extras qui font franchir le palier, au coût marginal", () => {
    const needs = ["green", "ice", "latte", "terra", "pink"].map((r) =>
      need(r),
    );
    const extras = ["moss", "sand", "rust", "sky"].map((r) => need(r));
    const plan = planBasket(refs, needs, extras, 10);
    // 5 → 6 : +1 ; 5 → 10 : +5 (4 seulement disponibles : pas de palier 10)
    const six = plan.options.find((o) => o.extras === 1)!;
    expect(six.totals.units).toBe(6);
    expect(six.marginalEurCents).toBeLessThan(1699 / 2);
    expect(plan.recommended!.extras).toBe(1);
  });

  it("ne recommande pas un extra au prix presque plein", () => {
    const plan = planBasket(refs, [need("green")], [need("ice")], 5);
    const two = plan.options.find((o) => o.extras === 1)!;
    expect(two.marginalEurCents).toBeGreaterThan(1699 / 2);
    expect(plan.recommended!.extras).toBe(0);
  });

  it("huit besoins : deux extras pour le palier −40 % ne coûtent presque rien", () => {
    const needs = refs.slice(2, 10).map((r) => need(r.refId));
    const plan = planBasket(refs, needs, [need("sky", 2)], 20);
    const ten = plan.options.find((o) => o.extras === 2)!;
    expect(ten.totals.units).toBe(10);
    expect(ten.totals.tierPercent).toBe(40);
    // 8 × 16,99 € à −30 % = 95,14 € ; 10 × 16,99 € à −40 % = 101,94 € : +6,80 €.
    expect(ten.marginalEurCents).toBe(680);
    expect(plan.recommended).toBe(ten);
  });
});
