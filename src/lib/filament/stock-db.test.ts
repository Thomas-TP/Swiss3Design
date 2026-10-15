import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { isMissingTable, loadReservations, type Queryable } from "./stock-db";

describe("isMissingTable : la migration du stock n'est pas appliquée", () => {
  it("reconnaît le code Postgres 42P01, direct ou dans la cause (Drizzle enveloppe l'erreur)", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(
      isMissingTable(
        Object.assign(new Error("Failed query"), { cause: { code: "42P01" } }),
      ),
    ).toBe(true);
  });
  it("ne masque aucune autre erreur", () => {
    expect(isMissingTable({ code: "23505" })).toBe(false);
    expect(isMissingTable(new Error("boom"))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});

// Lecture des réservations avec un faux accès à la base : on vérifie la
// composition (sondage de la migration 0011, requête de la boutique, cartes
// par référence), sans base. La requête elle-même est jouée sur la preview.
describe("loadReservations : la boutique réserve par référence (migration 0011)", () => {
  function fakeDb(options: { shopTable: boolean; shopRows?: unknown[] }) {
    const seen: { sql: string; params: unknown[] }[] = [];
    const db = {
      execute: async (query: SQL) => {
        const rendered = new PgDialect().sqlToQuery(query);
        seen.push(rendered);
        if (rendered.sql.includes("to_regclass"))
          return { rows: [{ ok: options.shopTable }] };
        if (rendered.sql.includes("FROM order_item_filaments"))
          return { rows: options.shopRows ?? [] };
        return { rows: [] };
      },
    } as unknown as Queryable;
    return { db, seen };
  }

  it("migration absente : rien de réservé par la boutique, aucune requête sur la table", async () => {
    const { db, seen } = fakeDb({ shopTable: false });
    const reservations = await loadReservations(db);
    expect(reservations).toEqual({ studio: {}, quote: {}, shop: {} });
    expect(seen.some((q) => q.sql.includes("FROM order_item_filaments"))).toBe(
      false,
    );
  });

  it("migration appliquée : grammes par id de référence, perte de 10 % passée en paramètre", async () => {
    const { db, seen } = fakeDb({
      shopTable: true,
      shopRows: [
        { id: "ref-white", grams: 330 },
        { id: "ref-black", grams: "220" },
      ],
    });
    const reservations = await loadReservations(db);
    expect(reservations.shop).toEqual({ "ref-white": 330, "ref-black": 220 });
    const shop = seen.find((q) => q.sql.includes("FROM order_item_filaments"))!;
    expect(shop.params).toContain(110);
    // Même règle de statut que le Studio, et jamais une commande déjà décomptée.
    expect(shop.sql).toContain("filament_consumptions");
    expect(shop.sql).toContain("reservation_expires_at > now()");
  });
});
