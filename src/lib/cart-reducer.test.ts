import { describe, expect, it } from "vitest";
import {
  isStudioLine,
  parseCart,
  parseCartLines,
  STUDIO_CART_TTL_MS,
  type CartItem,
  type CartLine,
  type StudioCartItem,
} from "./cart-data";
import { reducer } from "./cart-reducer";
import { buildStudioCartLine } from "./studio/cart-line";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  LAVAUX_DEFAULT,
} from "./studio/presets";

const product: CartItem = {
  productId: "p1",
  slug: "vase",
  name: "Vase",
  priceCents: 1000,
  imageUrl: null,
  saleType: "stock",
  quantity: 1,
};

const NOW = 1_800_000_000_000;

function cartouche(name = "Léa Dubois", quantity = 1): StudioCartItem {
  return buildStudioCartLine({
    config: CARTOUCHE_DEFAULT,
    texts: { name },
    locale: "fr",
    quantity,
    now: NOW,
  });
}

describe("ligne du Studio : fabrication", () => {
  it("porte les textes SAISIS nettoyés, les chiffres d'une pièce et le prix unitaire", () => {
    const line = cartouche("  Léa   Dubois ");
    expect(line.kind).toBe("studio");
    expect(line.texts).toEqual({ name: "Léa Dubois" });
    expect(line.grams).toBeGreaterThan(0);
    expect(line.changes).toBe(1);
    expect(line.priceCents % 10).toBe(0);
    expect(line.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("deux textes différents sont deux lignes ; le même texte, la même ligne", () => {
    expect(cartouche("Léa").id).not.toBe(cartouche("Lea").id);
    expect(cartouche("Léa").id).toBe(cartouche(" Léa ").id);
  });

  it("n'emporte pas le texte d'un champ que l'objet n'utilise pas", () => {
    const line = buildStudioCartLine({
      config: LAVAUX_DEFAULT,
      texts: { name: "Ne pas garder" },
      locale: "fr",
      quantity: 1,
    });
    expect(line.texts).toEqual({});
  });
});

describe("réducteur du panier : lignes du Studio", () => {
  it("ajoute, additionne les quantités d'une même ligne (plafond 20) et recalcule le prix", () => {
    let state: CartLine[] = [];
    state = reducer(state, { type: "addStudio", item: cartouche("Léa", 1) });
    const first = state[0] as StudioCartItem;
    expect(first.priceCents).toBe(1790);
    state = reducer(state, { type: "addStudio", item: cartouche("Léa", 9) });
    expect(state).toHaveLength(1);
    const ten = state[0] as StudioCartItem;
    expect(ten.quantity).toBe(10);
    expect(ten.priceCents).toBeLessThan(first.priceCents);
    state = reducer(state, { type: "addStudio", item: cartouche("Léa", 15) });
    expect((state[0] as StudioCartItem).quantity).toBe(20);
  });

  it("changer la quantité recalcule le prix : le fixe de la ligne est partagé", () => {
    let state: CartLine[] = [cartouche("Léa", 1)];
    const id = (state[0] as StudioCartItem).id;
    state = reducer(state, { type: "setStudioQuantity", id, quantity: 10 });
    const line = state[0] as StudioCartItem;
    expect(line.quantity).toBe(10);
    // Cartouche par défaut (10.4 g, 1 changement) : 4.90 × 10 ; ici le texte change peu les grammes.
    expect(line.priceCents).toBeLessThan(600);
    state = reducer(state, { type: "setStudioQuantity", id, quantity: 99 });
    expect((state[0] as StudioCartItem).quantity).toBe(20);
    state = reducer(state, { type: "setStudioQuantity", id, quantity: 0 });
    expect(state).toEqual([]);
  });

  it("n'accepte pas plus de dix lignes du Studio distinctes", () => {
    let state: CartLine[] = [];
    for (let i = 0; i < 14; i++)
      state = reducer(state, {
        type: "addStudio",
        item: cartouche(`Nom ${i}`),
      });
    expect(state.filter(isStudioLine)).toHaveLength(10);
  });

  it("« Mettre à jour le panier » remplace la ligne à sa place et fusionne avec une jumelle", () => {
    let state: CartLine[] = [product, cartouche("Léa"), cartouche("Zoé")];
    const oldId = (state[1] as StudioCartItem).id;
    state = reducer(state, {
      type: "replaceStudio",
      id: oldId,
      item: cartouche("Léa Martin", 2),
    });
    expect(state).toHaveLength(3);
    expect((state[1] as StudioCartItem).texts.name).toBe("Léa Martin");
    expect((state[1] as StudioCartItem).quantity).toBe(2);
    // Modifier « Léa Martin » en « Zoé » (quantité 1 choisie dans le Studio) : la ligne Zoé existe déjà, les quantités s'additionnent (1 + 1).
    state = reducer(state, {
      type: "replaceStudio",
      id: (state[1] as StudioCartItem).id,
      item: cartouche("Zoé", 1),
    });
    expect(state).toHaveLength(2);
    expect((state[1] as StudioCartItem).quantity).toBe(2);
  });

  it("supprime une ligne du Studio sans toucher aux produits", () => {
    const studio = cartouche("Léa");
    let state: CartLine[] = [product, studio];
    state = reducer(state, { type: "removeStudio", id: studio.id });
    expect(state).toEqual([product]);
  });

  it("les actions des produits ignorent les lignes du Studio", () => {
    const studio = cartouche("Léa");
    let state: CartLine[] = [studio];
    state = reducer(state, { type: "add", item: product });
    state = reducer(state, { type: "add", item: product });
    expect(state).toHaveLength(2);
    expect((state[1] as CartItem).quantity).toBe(2);
    state = reducer(state, {
      type: "remove",
      productId: "p1",
      variantId: null,
      colorKey: null,
    });
    expect(state).toEqual([studio]);
  });
});

describe("lecture du stockage local", () => {
  it("un ancien panier (produits seulement) se relit à l'identique", () => {
    const old = JSON.stringify([product, { ...product, productId: "p2" }]);
    expect(parseCartLines(old)).toEqual(parseCart(old));
    expect(parseCartLines(old)).toHaveLength(2);
  });

  it("un panier mixte garde l'ordre ; parseCart (relances, reprise par lien) n'en voit jamais le Studio", () => {
    const studio = cartouche("Léa");
    const raw = JSON.stringify([
      product,
      studio,
      { ...product, productId: "p2" },
    ]);
    const lines = parseCartLines(raw, NOW);
    expect(
      lines.map((l) => (isStudioLine(l) ? "studio" : l.productId)),
    ).toEqual(["p1", "studio", "p2"]);
    const products = parseCart(raw);
    expect(products.map((p) => p.productId)).toEqual(["p1", "p2"]);
    expect(JSON.stringify(products)).not.toContain("Léa");
  });

  it("écarte une ligne du Studio corrompue, expirée (30 jours) ou en double", () => {
    const studio = cartouche("Léa");
    const raw = JSON.stringify([
      studio,
      studio,
      { ...studio, id: "x", config: null },
      { ...studio, id: "y", quantity: 21 },
      { ...studio, id: "z", priceCents: -1 },
      { ...studio, id: "w", object: "vase" },
      { ...studio, id: "old", addedAt: NOW - STUDIO_CART_TTL_MS - 1 },
    ]);
    const lines = parseCartLines(raw, NOW);
    expect(lines).toHaveLength(1);
    expect(
      parseCartLines(JSON.stringify([studio]), NOW + STUDIO_CART_TTL_MS),
    ).toHaveLength(1);
    expect(
      parseCartLines(JSON.stringify([studio]), NOW + STUDIO_CART_TTL_MS + 1),
    ).toEqual([]);
  });

  it("ne garde des textes que les six champs connus, bornés", () => {
    const studio = cartouche("Léa");
    const raw = JSON.stringify([
      { ...studio, texts: { name: "Léa", hack: "x", role: "y".repeat(200) } },
    ]);
    const [line] = parseCartLines(raw, NOW) as StudioCartItem[];
    expect(line.texts).toEqual({ name: "Léa" });
  });

  it("aller-retour JSON stable", () => {
    const studio = buildStudioCartLine({
      config: BORNE_DEFAULT,
      texts: { text: "Léa" },
      locale: "de",
      quantity: 3,
      now: NOW,
    });
    expect(parseCartLines(JSON.stringify([studio]), NOW)).toEqual([studio]);
  });
});
