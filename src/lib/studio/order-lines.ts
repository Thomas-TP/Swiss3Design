// Les lignes du Studio d'un paiement, résolues côté serveur : validation stricte
// (purchase.ts), prix recalculé, écart avec le prix affiché, libellé de la ligne.
// Séparé de la route (api/checkout) pour se tester sans base ni Stripe.
//
// Le libellé (`name`, qui devient `order_items.name_snapshot`) ne contient JAMAIS
// un texte saisi : objet et dimensions, dans la langue de la commande. Il passe
// donc sans risque dans les e-mails, le suivi, les agents et les mesures.
import { lineName } from "@/components/studio/line-summary";
import type { Translate } from "@/components/studio/summary";
import {
  validateStudioLine,
  type StudioLineInput,
  type ValidatedStudioLine,
} from "./purchase";

export interface ResolvedStudioLine extends ValidatedStudioLine {
  /** Libellé sans texte saisi : « Vase Lavaux · H 180 mm · Ø 90 mm ». */
  name: string;
}

export type StudioResolution =
  | { ok: true; lines: ResolvedStudioLine[] }
  | { ok: false; status: 400 | 409 | 422; body: Record<string, unknown> };

/**
 * Valide et price les lignes du Studio d'un paiement. Premier échec = refus de
 * toute la requête, avant la moindre écriture. Un écart de prix (le prix
 * affiché au client n'est pas celui que le serveur recalcule) est un 409 qui
 * porte les prix du serveur : le client les prend et revalide, jamais de
 * facturation d'un montant que le client n'a pas vu.
 */
export function resolveStudioLines(
  inputs: StudioLineInput[],
  /** Messages `studioCore` de la langue de la commande (noms d'objets, unités). */
  core: Translate,
  locale: string,
): StudioResolution {
  const lines: ResolvedStudioLine[] = [];
  for (const input of inputs) {
    const result = validateStudioLine(input);
    if (!result.ok) {
      // Jamais de texte saisi dans le journal ni dans la réponse : le code et l'objet.
      console.warn("[checkout] ligne du Studio refusée", {
        object: input.object,
        error: result.error,
        issues: result.issues,
      });
      return result.error === "unprintable"
        ? {
            ok: false,
            status: 422,
            body: {
              error: "studio_unprintable",
              lineId: result.clientId,
              issues: result.issues,
            },
          }
        : {
            ok: false,
            status: 400,
            body: {
              error: "studio_invalid",
              lineId: result.clientId,
              reason: result.error,
            },
          };
    }
    const line = result.line;
    lines.push({
      ...line,
      name: lineName({
        config: line.config,
        stats: line.stats,
        core,
        locale,
      }),
    });
  }

  const drifted = lines.filter(
    (line) =>
      line.expectedUnitCents !== null &&
      line.expectedUnitCents !== line.unitCents,
  );
  if (drifted.length > 0) {
    for (const line of drifted)
      console.warn("[checkout] studio_price_mismatch", {
        object: line.object,
        expected: line.expectedUnitCents,
        server: line.unitCents,
      });
    return {
      ok: false,
      status: 409,
      body: {
        error: "price_changed",
        lines: drifted.map((line) => ({
          id: line.clientId ?? line.id,
          unitCents: line.unitCents,
        })),
      },
    };
  }
  return { ok: true, lines };
}
