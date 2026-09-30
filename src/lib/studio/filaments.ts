// Palette de filaments du Studio (brief « Strates », §2.1 : « Palette de
// filaments du Studio (données, pas jetons) »). Les teintes sont INDICATIVES
// tant que le propriétaire n'a pas fourni l'inventaire réel des bobines
// (§11.2) : l'interface affiche alors « Teintes indicatives, couleur finale
// selon les bobines en stock ». Les NOMS sont traduits dans le namespace
// `studioCore` (filaments.<id>) ; ce fichier ne porte que l'identifiant, la
// teinte et l'état commercial.
import type { FilamentId } from "./types";

export interface FilamentInfo {
  id: FilamentId;
  /** Teinte d'affichage (sRGB). Indicative : la couleur finale dépend de la bobine. */
  hex: string;
  /** Vrai tant que l'inventaire réel n'est pas validé (toutes les teintes aujourd'hui). */
  indicative: true;
  /** Déjà vendu dans la boutique (« Blanc », « Noir ») ; sinon à confirmer. */
  sold: boolean;
}

export const FILAMENTS: readonly FilamentInfo[] = [
  { id: "blanc-neve", hex: "#F5F5F4", indicative: true, sold: true },
  { id: "encre", hex: "#1C1917", indicative: true, sold: true },
  { id: "rouge-signal", hex: "#E5231C", indicative: true, sold: false },
  { id: "bleu-leman", hex: "#2E6A9E", indicative: true, sold: false },
  { id: "vert-lavaux", hex: "#5E7F3A", indicative: true, sold: false },
  { id: "gris-molasse", hex: "#8C8A85", indicative: true, sold: false },
  { id: "ambre", hex: "#D98E1F", indicative: true, sold: false },
  { id: "glacier", hex: "#9CC3DA", indicative: true, sold: false },
];

export const FILAMENT_IDS: readonly FilamentId[] = FILAMENTS.map((f) => f.id);

const BY_ID = new Map<FilamentId, FilamentInfo>(
  FILAMENTS.map((f) => [f.id, f]),
);

/** Vrai tant que toutes les teintes sont indicatives (affichage de la mention). */
export const FILAMENTS_INDICATIVE = FILAMENTS.every((f) => f.indicative);

export function isFilamentId(value: unknown): value is FilamentId {
  return typeof value === "string" && BY_ID.has(value as FilamentId);
}

export function filamentInfo(id: FilamentId): FilamentInfo {
  const info = BY_ID.get(id);
  if (!info) throw new Error(`Filament inconnu : ${String(id)}`);
  return info;
}

export function filamentHex(id: FilamentId): string {
  return filamentInfo(id).hex;
}

/** `#RRGGBB` → composantes 0–255. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `#RRGGBB` assombri de `amount` (0–1), vers le noir : filet des posters « strates ». */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = 1 - Math.min(Math.max(amount, 0), 1);
  const to = (c: number) =>
    Math.round(c * k)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** `#RRGGBB` éclairci de `amount` (0–1), vers le blanc. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = Math.min(Math.max(amount, 0), 1);
  const to = (c: number) =>
    Math.round(c + (255 - c) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
