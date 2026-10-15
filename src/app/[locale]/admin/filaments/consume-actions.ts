"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { filamentQuoteDetails } from "@/db/schema";
import {
  LedgerError,
  consumeForSource,
  undoConsumption,
  type Source,
} from "@/lib/filament/ledger";
import { invalidatePublicStock } from "@/lib/filament/public-stock";
import { requireFreshAdmin } from "@/lib/session";
import type { AdminFormState } from "./action-form";

// Décompte du filament d'une commande ou d'un devis (panneau des pages admin
// commande et devis) : grammes proposés et éditables, bobine(s) choisie(s).

async function finish(message: string): Promise<AdminFormState> {
  await invalidatePublicStock();
  revalidatePath("/", "layout");
  return { ok: message };
}

/** Paires `spool` / `grams` du formulaire, dans l'ordre (plusieurs bobines possibles par couleur). */
function allocationsOf(data: FormData) {
  const spools = data.getAll("spool").map(String);
  const grams = data
    .getAll("grams")
    .map((g) => Number(String(g).replace(",", ".")));
  const out: { spoolId: string; grams: number }[] = [];
  for (let i = 0; i < spools.length; i++) {
    const g = grams[i];
    if (!spools[i] || !Number.isFinite(g) || g <= 0) continue;
    out.push({ spoolId: spools[i], grams: Math.round(g) });
  }
  return out;
}

async function consume(
  source: Source,
  data: FormData,
): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  const allocations = allocationsOf(data);
  if (allocations.length === 0)
    return { error: "Aucun gramme à décompter (bobine et grammes)." };
  try {
    const db = await getDb();
    await db.transaction((tx) =>
      consumeForSource(tx, source, allocations, session.user.id),
    );
  } catch (error) {
    if (error instanceof LedgerError && error.code === "already_consumed")
      return { error: "Le décompte de cette fiche est déjà fait." };
    console.error("[stock] décompte refusé", error);
    return { error: "Décompte impossible." };
  }
  return finish("Décompte enregistré : le filament est retiré des bobines.");
}

async function undo(source: Source): Promise<AdminFormState> {
  const session = await requireFreshAdmin();
  const db = await getDb();
  await db.transaction((tx) => undoConsumption(tx, source, session.user.id));
  return finish(
    "Décompte annulé : les grammes sont remis et réservés de nouveau.",
  );
}

export async function consumeOrderFilament(
  _prev: AdminFormState,
  data: FormData,
) {
  return consume({ orderId: String(data.get("orderId") ?? "") }, data);
}
export async function undoOrderFilament(_prev: AdminFormState, data: FormData) {
  return undo({ orderId: String(data.get("orderId") ?? "") });
}
export async function consumeQuoteFilament(
  _prev: AdminFormState,
  data: FormData,
) {
  return consume({ quoteId: String(data.get("quoteId") ?? "") }, data);
}
export async function undoQuoteFilament(_prev: AdminFormState, data: FormData) {
  return undo({ quoteId: String(data.get("quoteId") ?? "") });
}

/** Grammes par couleur d'un devis (saisis par l'admin) : ils réservent dès « accepté ». */
export async function saveQuotePlan(
  _prev: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  await requireFreshAdmin();
  const quoteId = String(data.get("quoteId") ?? "");
  const plan: Record<string, number> = {};
  for (const [name, value] of data.entries()) {
    if (!name.startsWith("plan:")) continue;
    const grams = Number(String(value).replace(",", "."));
    if (Number.isFinite(grams) && grams > 0 && grams <= 20_000)
      plan[name.slice(5)] = Math.round(grams);
  }
  const db = await getDb();
  await db
    .insert(filamentQuoteDetails)
    .values({ quoteId, plan })
    .onConflictDoUpdate({
      target: filamentQuoteDetails.quoteId,
      set: { plan },
    });
  return finish("Grammes du devis enregistrés.");
}
