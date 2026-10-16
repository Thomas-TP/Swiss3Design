// Projet de couleurs d'une demande de devis, pour la fiche admin : le 3MF peint
// (téléchargement par /api/admin/files) et son résumé, avec le nom de chaque
// couleur. Lecture fraîche (règle d'or 6c) ; table absente (migration 0012 pas
// encore appliquée) : pas de projet, la fiche s'affiche comme avant.
import { and, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { filamentRefs, quoteColorProjects } from "@/db/schema";
import { isMissingTable } from "@/lib/filament/stock-db";
import type { ColorProjectSummary } from "./summary";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface AdminColorProject {
  fileKey: string;
  fileName: string;
  summary: ColorProjectSummary;
  /** Nom de chaque couleur, dans l'ordre des filaments du 3MF. */
  names: string[];
}

export async function loadQuoteColorProject(
  db: Db,
  quoteId: string,
): Promise<AdminColorProject | null> {
  try {
    const [row] = await db
      .select()
      .from(quoteColorProjects)
      .where(and(eq(quoteColorProjects.quoteId, quoteId), uncached));
    if (!row) return null;
    const ids = row.summary.colors.map((c) => c.ref);
    const refs = ids.length
      ? await db
          .select({
            id: filamentRefs.id,
            name: filamentRefs.officialName,
            brand: filamentRefs.brand,
            range: filamentRefs.rangeName,
          })
          .from(filamentRefs)
          .where(inArray(filamentRefs.id, ids))
      : [];
    const byId = new Map(
      refs.map((r) => [r.id, `${r.name} (${r.brand} ${r.range})`]),
    );
    return {
      fileKey: row.fileKey,
      fileName: row.fileName,
      summary: row.summary,
      names: ids.map((id) => byId.get(id) ?? id),
    };
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}
