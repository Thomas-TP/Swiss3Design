"use server";

import { verifyOwnedUpload } from "@/lib/upload";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import {
  filamentQuoteDetails,
  filamentRefs,
  quoteColorProjects,
  quoteRequests,
} from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { queueEmail, drainEmailOutbox } from "@/lib/outbox";
import { getAdminEmails } from "@/lib/email";
import { adminNewQuoteEmail } from "@/lib/email-templates";
import { recordStatusTransition } from "@/lib/status-history";
import { covers, quoteNeedGrams } from "@/lib/filament/availability";
import {
  CUSTOM_MATERIAL,
  QUOTE_COLORS_MAX,
  QUOTE_QUANTITY_MAX,
} from "@/lib/filament/constants";
import { isMissingTable, loadStockSnapshot } from "@/lib/filament/stock-db";
import {
  parseColorProject,
  type ColorProjectSummary,
} from "@/lib/paint3d/summary";

/** « 3MF peint · Blanc 70 %, Rouge 30 % · échelle 120 % · ≈ 45 changements » (e-mail interne). */
function colorProjectLine(
  summary: ColorProjectSummary,
  names: readonly string[],
): string {
  const parts = ["3MF peint (Bambu Studio)"];
  if (summary.colors.length > 0)
    parts.push(
      summary.colors
        .map((c, i) => `${names[i] ?? c.ref} ${Math.round(c.share * 100)} %`)
        .join(", "),
    );
  if (summary.scale !== 1)
    parts.push(`échelle ${Math.round(summary.scale * 1000) / 10} %`);
  if (summary.rotated) parts.push("orientation modifiée");
  if (summary.changes > 0)
    parts.push(`≈ ${summary.changes} changements de filament`);
  return parts.join(" · ");
}

// Une configuration du Studio porte sa ligne machine « S3D-STUDIO v1 … » dans la
// description : quand l'export du fichier n'a pas pu se faire (passage Studio →
// /custom sans fichier), cette configuration tient lieu de fichier.
const STUDIO_CONFIG_LINE = /S3D-STUDIO v1 /;

const schema = z.object({
  email: z.email(),
  description: z.string().min(10).max(4000),
  material: z.string().max(100).optional(),
  colors: z.string().max(200).optional(),
  dimensions: z.string().max(200).optional(),
  fileKey: z.string().startsWith("quotes/").max(300).optional(),
  fileName: z.string().max(200).optional(),
  // Projet de couleurs de l'atelier 3D : le 3MF peint, envoyé par la même route.
  colorProjectKey: z.string().startsWith("quotes/").max(300).optional(),
  colorProjectName: z.string().max(200).optional(),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
  // D'où vient la demande : la page /custom (« form ») ou le tiroir du Studio.
  source: z.enum(["form", "studio"]).catch("form"),
  quantity: z.coerce.number().int().min(1).max(QUOTE_QUANTITY_MAX).catch(1),
  // Couleurs du stock choisies (ids de référence), 0 à 4 : un tableau JSON.
  colorRefs: z
    .array(z.string().min(1).max(100))
    .max(QUOTE_COLORS_MAX)
    .catch([]),
  // Poids estimé d'UNE pièce par le navigateur : indicatif, jamais une preuve.
  estGrams: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .optional()
    .catch(undefined),
});

/** Pourquoi la demande est refusée (message adapté côté formulaire). */
export type QuoteRejection = "file" | "color" | "invalid";

export interface QuoteFormState {
  status: "idle" | "success" | "error";
  reason?: QuoteRejection;
}

function parseColorRefs(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function submitQuoteRequest(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  if (
    !(await rateLimit(
      new Request("https://swiss3design.ch", { headers: await headers() }),
      "quote-submit",
      { limit: 5, windowS: 600 },
    ))
  )
    return { status: "error" };
  const parsed = schema.safeParse({
    email: formData.get("email"),
    description: formData.get("description"),
    material: (formData.get("material") as string) || undefined,
    colors: (formData.get("colors") as string) || undefined,
    dimensions: (formData.get("dimensions") as string) || undefined,
    fileKey: (formData.get("fileKey") as string) || undefined,
    fileName: (formData.get("fileName") as string) || undefined,
    colorProjectKey: (formData.get("colorProjectKey") as string) || undefined,
    colorProjectName: (formData.get("colorProjectName") as string) || undefined,
    locale: formData.get("locale"),
    source: formData.get("source") || "form",
    quantity: formData.get("quantity") || 1,
    colorRefs: parseColorRefs(formData.get("colorRefs")),
    estGrams: formData.get("estGrams") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", reason: "invalid" };
  }

  const {
    fileKey,
    source,
    quantity,
    colorRefs,
    estGrams,
    colorProjectKey,
    colorProjectName,
    ...rest
  } = parsed.data;
  // Résumé du projet de couleurs : revalidé ici (zod), jamais pris tel quel. Ses
  // couleurs doivent être exactement celles choisies (même ordre) ; sinon le
  // projet n'est pas enregistré (la demande, elle, passe).
  const colorProjectSummary =
    source === "form" && colorProjectKey
      ? parseColorProject(formData.get("colorProject"))
      : null;
  // Un modèle 3D lisible est OBLIGATOIRE (client ET serveur). Seule exception : une
  // demande du Studio dont la configuration complète est dans la description.
  if (
    !fileKey &&
    !(source === "studio" && STUDIO_CONFIG_LINE.test(rest.description))
  )
    return { status: "error", reason: "file" };

  try {
    const session = await getServerSession();
    const db = await getDb();
    if (!(await verifyOwnedUpload(fileKey))) {
      return { status: "error", reason: "file" };
    }
    if (colorProjectKey && !(await verifyOwnedUpload(colorProjectKey))) {
      return { status: "error", reason: "file" };
    }

    // Couleurs du stock (formulaire de /custom seulement) : chaque id doit être une
    // référence active proposée en « sur mesure », et assez fournie pour la pièce
    // (poids estimé × quantité, avec la marge). Lecture fraîche : la couleur a pu
    // s'épuiser depuis l'affichage de la liste.
    const refIds = [...new Set(source === "form" ? colorRefs : [])];
    let colorNames: string[] = [];
    let shortNames: string[] = [];
    if (refIds.length > 0) {
      try {
        const refs = await db
          .select()
          .from(filamentRefs)
          .where(
            and(
              uncached,
              inArray(filamentRefs.id, refIds),
              eq(filamentRefs.active, true),
              eq(filamentRefs.customOk, true),
            ),
          );
        if (refs.length !== refIds.length)
          return { status: "error", reason: "color" };
        if (estGrams) {
          const snapshot = await loadStockSnapshot(db);
          const need = quoteNeedGrams(estGrams, quantity);
          for (const ref of refs) {
            const available = snapshot.availability.get(ref.id)?.available ?? 0;
            if (!covers(available, need))
              return { status: "error", reason: "color" };
          }
        }
        // Dans l'ordre choisi (celui des filaments du projet de couleurs).
        const byId = new Map(refs.map((r) => [r.id, r]));
        colorNames = refIds.map((id) => {
          const r = byId.get(id)!;
          return `${r.officialName} (${r.brand} ${r.rangeName})`;
        });
        shortNames = refIds.map((id) => byId.get(id)!.officialName);
      } catch (error) {
        if (!isMissingTable(error)) throw error;
        // Stock pas encore en base : le choix de couleurs ne peut pas être vérifié.
        return { status: "error", reason: "color" };
      }
    }

    const adminEmails = await getAdminEmails();
    await db.transaction(async (db) => {
      const [created] = await db
        .insert(quoteRequests)
        .values({
          ...rest,
          // /custom : le PLA, seule matière de l'atelier, quoi qu'envoie le client.
          material: source === "form" ? CUSTOM_MATERIAL : rest.material,
          // Le texte des couleurs vient des références du stock, jamais du client.
          colors:
            colorNames.length > 0
              ? colorNames.join(", ").slice(0, 200)
              : rest.colors,
          fileUrl: fileKey ?? null,
          customerId: session?.user.id ?? null,
        })
        .returning({ id: quoteRequests.id });
      await recordStatusTransition(db, {
        entityType: "quote",
        entityId: created.id,
        fromStatus: null,
        toStatus: "received",
        source: "customer",
        actorId: session?.user.id ?? null,
      });

      // Projet de couleurs (atelier 3D) : 3MF peint et résumé. Table à part, comme
      // les détails du stock : une migration pas encore appliquée ne perd jamais la
      // demande (le fichier reste dans le R2, retrouvable par sa clé).
      let storedProject: ColorProjectSummary | null = null;
      const sameColors =
        colorProjectSummary !== null &&
        colorProjectSummary.colors.length === refIds.length &&
        colorProjectSummary.colors.every((c, i) => c.ref === refIds[i]);
      if (colorProjectKey && colorProjectSummary && sameColors) {
        try {
          await db.transaction(async (savepoint) => {
            await savepoint.insert(quoteColorProjects).values({
              quoteId: created.id,
              fileKey: colorProjectKey,
              fileName: colorProjectName ?? "couleurs.3mf",
              summary: colorProjectSummary,
            });
          });
          // L'e-mail ne l'annonce que s'il est retrouvable sur la fiche admin.
          storedProject = colorProjectSummary;
        } catch (error) {
          if (!isMissingTable(error)) throw error;
          console.warn(
            "[quote] table des projets de couleurs absente : projet ignoré",
          );
        }
      }

      // Quantité, couleurs choisies et poids estimé : table du stock. Un échec ne doit
      // jamais faire perdre la demande (migration pas appliquée : on s'en passe).
      if (source === "form") {
        try {
          await db.transaction(async (savepoint) => {
            await savepoint.insert(filamentQuoteDetails).values({
              quoteId: created.id,
              quantity,
              colorRefs: refIds.length > 0 ? refIds : null,
              estGrams: estGrams ?? null,
            });
          });
        } catch (error) {
          if (!isMissingTable(error)) throw error;
          console.warn("[quote] tables du stock absentes : détails ignorés");
        }
      }

      // Notification interne : nouvelle demande à chiffrer.
      // Ne doit jamais faire échouer l'enregistrement de la demande.
      {
        if (adminEmails.length > 0) {
          await queueEmail(
            db,
            "quote-new:" + created.id,
            adminNewQuoteEmail(
              {
                id: created.id,
                email: rest.email,
                description: rest.description,
                material:
                  source === "form" ? CUSTOM_MATERIAL : (rest.material ?? null),
                colors:
                  colorNames.length > 0
                    ? colorNames.join(", ")
                    : (rest.colors ?? null),
                dimensions: rest.dimensions ?? null,
                fileName: rest.fileName ?? null,
                locale: rest.locale,
                quantity: source === "form" ? quantity : null,
                estGrams: source === "form" ? (estGrams ?? null) : null,
                colorProject: storedProject
                  ? colorProjectLine(storedProject, shortNames)
                  : null,
              },
              adminEmails,
            ),
          );
        }
      }
    });
    try {
      await drainEmailOutbox(db);
    } catch {
      console.error("[outbox] reprise par maintenance");
    }

    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}
