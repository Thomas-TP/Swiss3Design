// Palette de filaments du Studio : des bobines RÉELLES, la gamme Bambu Lab PLA
// Matte. Décision du propriétaire du 15.10.2026 (elle remplace la palette
// Polymaker du 14.10) : les couleurs proposées sur le site sont EXACTEMENT les hex
// officiels du PDF Bambu « PLA Matte Hex Code », au caractère près. Les NOMS du
// Studio (Blanc névé, Encre…) restent, traduits dans le namespace `studioCore`
// (filaments.<id>) ; ce fichier porte l'identifiant, la teinte, la bobine (marque,
// gamme, nom officiel, code produit : l'atelier sait quelle bobine charger) et
// l'état commercial.
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
  brand: "Bambu Lab";
  /** Gamme de la bobine. */
  range: "PLA Matte";
  /** Nom officiel de la couleur chez le fabricant (Ivory White…). */
  officialName: string;
  /** Code produit du fabricant (Bambu : 11100…). */
  productCode: string;
  /** Vrai : la teinte à l'écran reste approximative (écran, éclairage), la bobine fait foi. */
  indicative: true;
  /** Déjà vendu dans la boutique (« Blanc », « Noir ») ; sinon à confirmer. */
  sold: boolean;
}

const BAMBU = {
  brand: "Bambu Lab",
  range: "PLA Matte",
  indicative: true,
} as const;

export const FILAMENTS: readonly FilamentInfo[] = [
  {
    id: "blanc-neve",
    hex: "#FFFFFF",
    officialName: "Ivory White",
    productCode: "11100",
    sold: true,
    ...BAMBU,
  },
  {
    id: "gris-molasse",
    hex: "#9B9EA0",
    officialName: "Ash Gray",
    productCode: "11102",
    sold: false,
    ...BAMBU,
  },
  {
    id: "encre",
    hex: "#000000",
    officialName: "Charcoal",
    productCode: "11101",
    sold: true,
    ...BAMBU,
  },
  {
    id: "vert-foret",
    hex: "#68724D",
    officialName: "Dark Green",
    productCode: "11501",
    sold: false,
    ...BAMBU,
  },
  {
    id: "bleu-leman",
    hex: "#0078BF",
    officialName: "Marine Blue",
    productCode: "11600",
    sold: false,
    ...BAMBU,
  },
  {
    id: "glacier",
    hex: "#A3D8E1",
    officialName: "Ice Blue",
    productCode: "11601",
    sold: false,
    ...BAMBU,
  },
  {
    id: "gres",
    hex: "#D3B7A7",
    officialName: "Latte Brown",
    productCode: "11800",
    sold: false,
    ...BAMBU,
  },
  {
    id: "terre-cuite",
    hex: "#B15533",
    officialName: "Terracotta",
    productCode: "11203",
    sold: false,
    ...BAMBU,
  },
  {
    id: "rouge-signal",
    hex: "#DE4343",
    officialName: "Scarlet Red",
    productCode: "11200",
    sold: false,
    ...BAMBU,
  },
  {
    id: "rose-alpes",
    hex: "#E8AFCF",
    officialName: "Sakura Pink",
    productCode: "11201",
    sold: false,
    ...BAMBU,
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

/**
 * Filet d'une strate sur un poster : plus sombre que sa teinte (`shade`). Une
 * teinte déjà très sombre (l'encre, #000000) ne peut plus s'assombrir : son filet
 * s'éclaircit à la place, sinon les strates d'une bande noire disparaîtraient.
 * Jamais une pastille ni un aplat.
 */
export function edgeShade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.2 ? tint(hex, amount * 0.5) : shade(hex, amount);
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
