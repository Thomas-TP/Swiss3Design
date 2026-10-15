// Palette de filaments du Studio : des bobines RÉELLES, la gamme Polymaker
// Panchroma Matte (ex-PolyTerra, PLA mat). Décision du propriétaire du 14.10.2026 :
// les couleurs proposées sur le site sont EXACTEMENT les hex officiels de
// Polymaker (wiki Polymaker, « HEX Codes and Transmission Distances »), au
// caractère près. Les NOMS du Studio (Blanc névé, Encre…) restent, traduits dans
// le namespace `studioCore` (filaments.<id>) ; ce fichier porte l'identifiant, la
// teinte, la bobine (marque, gamme, nom officiel : l'atelier sait quelle bobine
// charger) et l'état commercial.
//
// RÈGLE : partout où une couleur de filament est AFFICHÉE (pastille, puce,
// aplat d'un poster, couleur de base du matériau 3D), c'est `filamentHex()`
// tel quel, sans `tint`, `shade`, transparence ni filtre. `shade` et `tint`
// ne servent qu'aux FILETS des posters (strates, contours), jamais à une pastille
// ni à un aplat de bande (filaments.test.ts le vérifie).
import type { FilamentId } from "./types";

export interface FilamentInfo {
  id: FilamentId;
  /** Teinte officielle du fabricant (sRGB, #RRGGBB) : la couleur affichée, sans transformation. */
  hex: string;
  /** Marque de la bobine. */
  brand: "Polymaker";
  /** Gamme de la bobine. */
  range: "Panchroma Matte";
  /** Nom officiel de la couleur chez le fabricant. */
  officialName: string;
  /** Vrai : la teinte à l'écran reste approximative (écran, éclairage), la bobine fait foi. */
  indicative: true;
  /** Déjà vendu dans la boutique (« Blanc », « Noir ») ; sinon à confirmer. */
  sold: boolean;
}

const POLYMAKER = {
  brand: "Polymaker",
  range: "Panchroma Matte",
  indicative: true,
} as const;

export const FILAMENTS: readonly FilamentInfo[] = [
  {
    id: "blanc-neve",
    hex: "#F4EFEB",
    officialName: "Matte Cotton White",
    sold: true,
    ...POLYMAKER,
  },
  {
    id: "encre",
    hex: "#2F2E30",
    officialName: "Matte Charcoal Black",
    sold: true,
    ...POLYMAKER,
  },
  {
    id: "rouge-signal",
    hex: "#ED2F2E",
    officialName: "Matte Lava Red",
    sold: false,
    ...POLYMAKER,
  },
  {
    id: "bleu-leman",
    hex: "#0163A6",
    officialName: "Matte Sapphire Blue",
    sold: false,
    ...POLYMAKER,
  },
  {
    id: "vert-lavaux",
    hex: "#5F6244",
    officialName: "Matte Army Dark Green",
    sold: false,
    ...POLYMAKER,
  },
  {
    id: "gris-molasse",
    hex: "#8A8C94",
    officialName: "Matte Fossil Grey",
    sold: false,
    ...POLYMAKER,
  },
  {
    id: "ambre",
    hex: "#F88B17",
    officialName: "Matte Sunrise Orange",
    sold: false,
    ...POLYMAKER,
  },
  {
    id: "glacier",
    hex: "#A4D0DF",
    officialName: "Matte Pastel Ice",
    sold: false,
    ...POLYMAKER,
  },
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

/** `#RRGGBB` assombri de `amount` (0–1), vers le noir : FILET des posters « strates » seulement (jamais une pastille ni un aplat). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = 1 - Math.min(Math.max(amount, 0), 1);
  const to = (c: number) =>
    Math.round(c * k)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** `#RRGGBB` éclairci de `amount` (0–1), vers le blanc : filet d'un poster en thème sombre seulement (jamais une pastille ni un aplat). */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = Math.min(Math.max(amount, 0), 1);
  const to = (c: number) =>
    Math.round(c + (255 - c) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
