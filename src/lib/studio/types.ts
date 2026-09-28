// Contrats de données du Studio (brief de refonte « Strates », §4.5, §6.2.1,
// §6.5). WP-00 crée le contrat ; WP-01 et WP-02 l'étendent SANS rupture
// (ajouts seulement). Pur TypeScript, sans three : lu par le SSR, le client,
// le Worker du Studio et le Stage (qui ne fait qu'envelopper les Float32Array
// dans des BufferGeometry). Unités : mm, Z vers le haut.

export type StudioObjectId = "lavaux" | "cartouche" | "relief" | "borne";

export type FilamentId =
  | "blanc-neve"
  | "encre"
  | "rouge-signal"
  | "bleu-leman"
  | "vert-lavaux"
  | "gris-molasse"
  | "ambre"
  | "glacier";

/**
 * Bande de couleur : les bandes sont contiguës depuis z = 0, frontières
 * quantifiées à 0,2 mm ; la dernière finit à la hauteur totale (§6.4).
 */
export interface Band {
  filament: FilamentId;
  toMm: number;
}

/**
 * Textes saisis par le visiteur. JAMAIS dans l'URL, le fragment, un
 * événement d'analytics ni un attribut non masqué (§4.10) : mémoire,
 * sessionStorage (texts-store.ts) puis la seule Server Action de devis.
 */
export interface StudioTexts {
  name?: string;
  role?: string;
  line1?: string;
  line2?: string;
  peak?: string;
  text?: string;
}

/** Maillage produit par les générateurs purs de src/lib/studio/**. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** 0 = paroi extérieure, 1 = intérieure (lignes fantômes du matériau d'impression). */
  side?: Float32Array;
  groups: { start: number; count: number; band: number }[];
  /** mm, Z vers le haut : [minX, minY, minZ, maxX, maxY, maxZ]. */
  bbox: [number, number, number, number, number, number];
  triangles: number;
}

// ── Configurations (§6.2.1) ──────────────────────────────────────────────────
// Noms longs côté TypeScript ; le codec d'URL (url-state.ts, WP-01) les
// traduit vers les clés courtes du fragment #c= et des paramètres GET. Les
// textes n'y figurent jamais.

export type LavauxPattern =
  | { kind: "lisse" }
  | { kind: "gradins"; step: number; depth: number }
  | { kind: "vagues"; wavelength: number; amplitude: number; lobes: number }
  | { kind: "voronoi"; cells: number; relief: number; seed: number }
  | { kind: "nervures"; count: number; depth: number; twistDeg: number };

export interface LavauxConfig {
  object: "lavaux";
  h: number;
  d: number;
  profile: "cylindre" | "galet" | "amphore" | "cone" | "tulipe";
  belly: number;
  neck: number;
  lip: number;
  pattern: LavauxPattern;
  wall: 1.2 | 1.6 | 2 | 2.4;
  bands: Band[];
}

export interface CartoucheConfig {
  object: "cartouche";
  thickness: number;
  corner: number;
  mode: "relief" | "gravure";
  depth: number;
  layout: "classique" | "centree" | "cartouche" | "monogramme";
  /** Texte : StudioTexts.name, role, line1, line2. */
  plate: FilamentId;
  ink: FilamentId;
}

export interface ReliefConfig {
  object: "relief";
  shape: "rond" | "carre";
  size: number;
  base: number;
  relief: number;
  levels: number;
  seed: number;
  lake: number;
  /** 2 à 4, calées sur les sommets de strates. */
  bands: Band[];
  /** Texte : StudioTexts.peak. */
  label: boolean;
}

export interface BorneConfig {
  object: "borne";
  shape: "pilule" | "etiquette" | "goutte" | "pic";
  cap: number;
  thickness: number;
  ring: "gauche" | "droite" | "aucun";
  ringD: number;
  mode: "relief" | "gravure";
  /** Texte : StudioTexts.text. */
  base: FilamentId;
  ink: FilamentId;
}

export type StudioConfig =
  | LavauxConfig
  | CartoucheConfig
  | ReliefConfig
  | BorneConfig;

export type IssueCode =
  | "overhang"
  | "base-narrow"
  | "plate"
  | "band-thin"
  | "pattern-coupling"
  | "text-stroke"
  | "text-fit"
  | "text-char"
  | "near-vase-spirale";

// ── Statistiques et imprimabilité (§6.5 ; calcul dans stats.ts, WP-01) ──────

export type Printability =
  | { status: "ok" }
  | {
      status: "warn" | "error";
      issues: {
        code: IssueCode;
        atMm?: number;
        value?: number;
        fix?: Partial<StudioConfig>;
      }[];
    };

export interface StudioStats {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  /** ceil(h / 0,2). */
  layers: number;
  volumeCm3: number;
  grams: number;
  minutes: number;
  changes: number;
  purgeGrams: number;
  printable: Printability;
  /** Centimes entiers ; null tant que PRICING.validated = false (aucun CHF affiché). */
  estimate?: { lowCents: number; highCents: number } | null;
}

/** Garde de type partagée par les stockages locaux (créations, textes, devis). */
export const STUDIO_OBJECT_IDS: readonly StudioObjectId[] = [
  "lavaux",
  "cartouche",
  "relief",
  "borne",
];

export function isStudioObjectId(value: unknown): value is StudioObjectId {
  return (
    typeof value === "string" &&
    (STUDIO_OBJECT_IDS as readonly string[]).includes(value)
  );
}
