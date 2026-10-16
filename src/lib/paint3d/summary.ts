// Résumé d'un projet de couleurs joint à une demande de devis : ce que le
// visiteur a réglé dans l'atelier 3D (couleurs par zone, taille, orientation),
// à côté du 3MF peint qu'il a envoyé. Partagé par le navigateur (qui le produit)
// et la Server Action (qui le revalide et l'enregistre) : zod seulement, rien de
// lourd. Les parts de surface et les changements de filament sont indicatifs :
// l'atelier tranche lui-même.
import { z } from "zod";
import { QUOTE_COLORS_MAX } from "@/lib/filament/constants";

export const colorProjectSchema = z.object({
  v: z.literal(1),
  /** Échelle appliquée (1 = la taille du fichier). */
  scale: z.number().min(0.01).max(100),
  /** Boîte de la pièce posée sur le plateau, en mm (largeur, profondeur, hauteur). */
  size: z.tuple([
    z.number().min(0).max(100_000),
    z.number().min(0).max(100_000),
    z.number().min(0).max(100_000),
  ]),
  /** Orientation changée (quart de tour, face posée). */
  rotated: z.boolean(),
  triangles: z.number().int().min(1).max(50_000_000),
  /** Couleurs dans l'ordre des filaments du 3MF (1 = la base). */
  colors: z
    .array(
      z.object({
        ref: z.string().min(1).max(100),
        /** Part de la surface (0 à 1). */
        share: z.number().min(0).max(1),
      }),
    )
    .max(QUOTE_COLORS_MAX),
  /** Changements de filament estimés (couches de 0,2 mm). */
  changes: z.number().int().min(0).max(10_000_000),
  /** Les couleurs viennent du fichier (déjà peint), du visiteur, ou des deux. */
  origin: z.enum(["file", "painted", "both", "none"]),
});

export type ColorProjectSummary = z.infer<typeof colorProjectSchema>;

/** Le résumé tient-il dans un champ de formulaire raisonnable ? */
export const COLOR_PROJECT_MAX_CHARS = 4000;

export function parseColorProject(raw: unknown): ColorProjectSummary | null {
  if (
    typeof raw !== "string" ||
    raw === "" ||
    raw.length > COLOR_PROJECT_MAX_CHARS
  )
    return null;
  try {
    const parsed = colorProjectSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
