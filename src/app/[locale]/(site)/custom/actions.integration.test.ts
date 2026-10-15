import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, like } from "drizzle-orm";
import * as schema from "@/db/schema";
import { recordMovement } from "@/lib/filament/ledger";

// Server Action submitQuoteRequest, de bout en bout contre la branche Neon PREVIEW
// isolée : fichier 3D obligatoire (le Studio garde sa configuration), couleurs du
// stock vérifiées avec une lecture fraîche, détails du stock écrits avec la demande.
// Seuls le quota, la session, les en-têtes, le contrôle R2 et l'e-mail sont simulés.
const database = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({ getDb: async () => database.current }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => true }));
vi.mock("@/lib/session", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/upload", () => ({ verifyOwnedUpload: async () => true }));
vi.mock("@/lib/email", () => ({ getAdminEmails: async () => [] }));

const url = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!url)(
  "submitQuoteRequest : fichier, couleurs, stock (preview isolé)",
  () => {
    const pool = new Pool({ connectionString: url, max: 4 });
    const db = drizzle(pool, { schema });
    const tag = "quote-" + crypto.randomUUID().slice(0, 8);
    const email = `${tag}@example.invalid`;
    const refId = `${tag}-ref`;
    const spoolIds: string[] = [];
    let submit: typeof import("./actions").submitQuoteRequest;

    beforeAll(async () => {
      if (
        !url ||
        new URL(url).hostname !==
          "ep-green-tooth-aswk3vbr.c-4.eu-central-1.aws.neon.tech"
      )
        throw new Error(
          "Tests autorisés uniquement sur la branche preview identifiée",
        );
      database.current = db;
      ({ submitQuoteRequest: submit } = await import("./actions"));
      await db.insert(schema.filamentRefs).values({
        id: refId,
        brand: "Test",
        rangeName: tag,
        officialName: "Couleur de test",
        hex: "#112233",
        customOk: true,
      });
      const [spool] = await db
        .insert(schema.filamentSpools)
        .values({
          refId,
          spoolType: "other",
          tareGrams: 0,
          initialGrams: 1000,
          remainingGrams: 0,
          status: "in_stock",
          note: tag,
        })
        .returning();
      spoolIds.push(spool.id);
      // 300 g disponibles : un devis de 100 g (besoin 130 g) passe, un de 300 g (360 g) non.
      await db.transaction((tx) =>
        recordMovement(tx, {
          spoolId: spool.id,
          kind: "adjust",
          absolute: 300,
        }),
      );
    });

    function form(fields: Record<string, string | undefined>) {
      const data = new FormData();
      const base = {
        email,
        description: "Demande de test du stock de filament, à ignorer.",
        locale: "fr",
        source: "form",
        quantity: "1",
        ...fields,
      };
      for (const [k, v] of Object.entries(base))
        if (v !== undefined) data.set(k, v);
      return data;
    }
    const FILE = { fileKey: "quotes/test-cube.stl", fileName: "cube.stl" };
    const idle = { status: "idle" } as const;

    it("sans fichier : refusé (« file »), rien n'est écrit", async () => {
      const result = await submit(idle, form({}));
      expect(result).toEqual({ status: "error", reason: "file" });
      const rows = await db
        .select()
        .from(schema.quoteRequests)
        .where(eq(schema.quoteRequests.email, email));
      expect(rows).toHaveLength(0);
    });

    it("Studio sans fichier : refusé sans sa ligne de configuration, accepté avec", async () => {
      expect(await submit(idle, form({ source: "studio" }))).toEqual({
        status: "error",
        reason: "file",
      });
      const ok = await submit(
        idle,
        form({
          source: "studio",
          description:
            "Vase Lavaux, 150 mm.\nS3D-STUDIO v1 lavaux h=150 d=96 bd=bleu-leman:42,vert-foret:108,blanc-neve:150",
        }),
      );
      expect(ok.status).toBe("success");
    });

    it("couleur inconnue ou plus de quatre : refusé (« color » ou « invalid »)", async () => {
      expect(
        await submit(
          idle,
          form({ ...FILE, colorRefs: JSON.stringify(["n-existe-pas"]) }),
        ),
      ).toEqual({ status: "error", reason: "color" });
    });

    it("couleur trop juste pour la pièce : refusé ; assez fournie : accepté avec les détails", async () => {
      const short = await submit(
        idle,
        form({
          ...FILE,
          colorRefs: JSON.stringify([refId]),
          estGrams: "300",
        }),
      );
      expect(short).toEqual({ status: "error", reason: "color" });

      const ok = await submit(
        idle,
        form({
          ...FILE,
          quantity: "2",
          colorRefs: JSON.stringify([refId]),
          estGrams: "50",
          colors: "texte libre ignoré",
        }),
      );
      expect(ok.status).toBe("success");
      const [quote] = await db
        .select()
        .from(schema.quoteRequests)
        .where(like(schema.quoteRequests.colors, "%Couleur de test%"));
      // Le texte des couleurs vient des références, jamais du client.
      expect(quote.colors).toBe(`Couleur de test (Test ${tag})`);
      expect(quote.fileUrl).toBe(FILE.fileKey);
      const [details] = await db
        .select()
        .from(schema.filamentQuoteDetails)
        .where(eq(schema.filamentQuoteDetails.quoteId, quote.id));
      expect(details).toMatchObject({
        quantity: 2,
        colorRefs: [refId],
        estGrams: 50,
      });
    });

    it("sans couleur du stock : la demande passe, avec quantité et poids estimé", async () => {
      const ok = await submit(
        idle,
        form({ ...FILE, quantity: "3", estGrams: "40", email: `b-${email}` }),
      );
      expect(ok.status).toBe("success");
      const [quote] = await db
        .select()
        .from(schema.quoteRequests)
        .where(eq(schema.quoteRequests.email, `b-${email}`));
      const [details] = await db
        .select()
        .from(schema.filamentQuoteDetails)
        .where(eq(schema.filamentQuoteDetails.quoteId, quote.id));
      expect(details).toMatchObject({
        quantity: 3,
        colorRefs: null,
        estGrams: 40,
      });
    });

    afterAll(async () => {
      const quotes = await db
        .select({ id: schema.quoteRequests.id })
        .from(schema.quoteRequests)
        .where(like(schema.quoteRequests.email, `%${tag}@example.invalid`));
      const ids = quotes.map((q) => q.id);
      if (ids.length) {
        await db
          .delete(schema.statusEvents)
          .where(inArray(schema.statusEvents.entityId, ids));
        await db
          .delete(schema.quoteRequests)
          .where(inArray(schema.quoteRequests.id, ids));
      }
      await db
        .delete(schema.filamentMovements)
        .where(inArray(schema.filamentMovements.spoolId, spoolIds));
      await db
        .delete(schema.filamentSpools)
        .where(inArray(schema.filamentSpools.id, spoolIds));
      await db
        .delete(schema.filamentRefs)
        .where(eq(schema.filamentRefs.id, refId));
      await pool.end();
    });
  },
);
