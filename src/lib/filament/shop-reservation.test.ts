import { describe, expect, it, vi } from "vitest";
import { recordShopReservations } from "./shop-reservation";

// La réservation d'une ligne de la boutique s'écrit dans la transaction de la
// commande : elle ne doit jamais la faire échouer (table absente, référence
// supprimée). Faux accès à la base : on vérifie ce qui est écrit et ce qui ne l'est pas.
function fakeTx(options: { table: boolean; knownRefs: string[] }) {
  const inserted: unknown[][] = [];
  const tx = {
    execute: async () => ({ rows: [{ ok: options.table }] }),
    select: () => ({
      from: () => ({
        where: async () => options.knownRefs.map((id) => ({ id })),
      }),
    }),
    insert: () => ({
      values: async (rows: unknown[]) => {
        inserted.push(rows);
      },
    }),
  };
  return {
    tx: tx as unknown as Parameters<typeof recordShopReservations>[0],
    inserted,
  };
}

const line = (orderItemId: string, refId: string, gramsPerPiece = 320) => ({
  orderItemId,
  refId,
  gramsPerPiece,
});

describe("recordShopReservations : jamais bloquant pour la commande", () => {
  it("écrit une ligne par article imprimé à la demande, grammes d'UNE pièce", async () => {
    const { tx, inserted } = fakeTx({
      table: true,
      knownRefs: ["r-white", "r-black"],
    });
    const result = await recordShopReservations(tx, [
      line("i1", "r-white", 320),
      line("i2", "r-black", 280),
    ]);
    expect(result).toBe("recorded");
    expect(inserted).toEqual([
      [
        { orderItemId: "i1", refId: "r-white", gramsPerPiece: 320 },
        { orderItemId: "i2", refId: "r-black", gramsPerPiece: 280 },
      ],
    ]);
  });

  it("table absente (migration 0011 pas appliquée) : journalisé, rien n'est écrit, la vente continue", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { tx, inserted } = fakeTx({ table: false, knownRefs: ["r-white"] });
    expect(await recordShopReservations(tx, [line("i1", "r-white")])).toBe(
      "untracked",
    );
    expect(inserted).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("référence supprimée (SKU périmé d'une commande déjà payée) : écartée, les autres sont écrites", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { tx, inserted } = fakeTx({ table: true, knownRefs: ["r-white"] });
    expect(
      await recordShopReservations(tx, [
        line("i1", "r-white"),
        line("i2", "r-gone"),
      ]),
    ).toBe("recorded");
    expect(inserted).toEqual([
      [{ orderItemId: "i1", refId: "r-white", gramsPerPiece: 320 }],
    ]);
    warn.mockRestore();
  });

  it("rien à réserver : aucune requête", async () => {
    const { tx, inserted } = fakeTx({ table: true, knownRefs: [] });
    expect(await recordShopReservations(tx, [])).toBe("nothing");
    expect(await recordShopReservations(tx, [line("i1", "r-gone")])).toBe(
      "nothing",
    );
    expect(inserted).toEqual([]);
  });
});
