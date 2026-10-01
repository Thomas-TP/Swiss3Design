// Schémas zod des configurations (brief « Strates », §6.2, §6.8) et validation
// d'une valeur inconnue (`parseConfig` : lien partagé, paramètres GET, outil
// WebMCP). Les plages, valeurs par défaut et le bornage vivent dans
// `ranges.ts` (sans zod), ré-exporté ici en entier : importer d'ici ou de là est
// équivalent, mais seul ce module embarque zod.
//
// Les schémas valident la FORME (types, plages, énumérations) : le couplage des
// paramètres et l'imprimabilité sont des garde-fous (guards.ts), qui signalent
// au lieu de refuser. Aucun texte personnel n'a de champ ici.
import { z } from "zod";
import { FILAMENT_IDS } from "./filaments";
import {
  BORNE_RANGES,
  CARTOUCHE_RANGES,
  LAVAUX_PROFILES,
  LAVAUX_RANGES,
  MAX_BANDS,
  RELIEF_RANGES,
  type Range,
} from "./ranges";
import type { Band, FilamentId, StudioConfig, StudioObjectId } from "./types";

export * from "./ranges";

// Sans compilation à la volée : zod sonde `Function("")` à la construction du
// premier objet pour savoir s'il peut compiler ses schémas. Sous la CSP de
// production (`script-src` sans 'unsafe-eval'), cette sonde est rapportée comme
// `securitypolicyviolation` (« eval ») sur chaque page du Studio, même si
// l'exception est avalée, et elle part dans /api/csp-report. `jitless` la
// saute (zod le documente pour cet usage) ; ces petits schémas, validés une
// fois par lien ou par outil WebMCP, n'en tirent aucun gain. Doit précéder la
// construction des schémas ci-dessous. Dans le Worker, zod ne compile déjà pas.
z.config({ jitless: true });

// ── Schémas zod (noms longs) ─────────────────────────────────────────────────

const num = (range: Range) => z.number().min(range.min).max(range.max);
const int = (range: Range) => z.number().int().min(range.min).max(range.max);
const filament = z.enum(FILAMENT_IDS as [FilamentId, ...FilamentId[]]);

const bandSchema = z.strictObject({
  filament,
  toMm: z.number().positive().max(300),
});

/** Bandes contiguës depuis z = 0 : frontières croissantes ; la dernière finit à `total`. */
function bandsSchema(min: number, max: number) {
  return z.array(bandSchema).min(min).max(max);
}

const patternSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("lisse") }),
  z.strictObject({
    kind: z.literal("gradins"),
    step: num(LAVAUX_RANGES.gradins.step),
    depth: num(LAVAUX_RANGES.gradins.depth),
  }),
  z.strictObject({
    kind: z.literal("vagues"),
    wavelength: num(LAVAUX_RANGES.vagues.wavelength),
    amplitude: num(LAVAUX_RANGES.vagues.amplitude),
    lobes: int(LAVAUX_RANGES.vagues.lobes),
  }),
  z.strictObject({
    kind: z.literal("voronoi"),
    cells: int(LAVAUX_RANGES.voronoi.cells),
    relief: num(LAVAUX_RANGES.voronoi.relief),
    seed: int(LAVAUX_RANGES.voronoi.seed),
  }),
  z.strictObject({
    kind: z.literal("nervures"),
    count: int(LAVAUX_RANGES.nervures.count),
    depth: num(LAVAUX_RANGES.nervures.depth),
    twistDeg: num(LAVAUX_RANGES.nervures.twistDeg),
  }),
]);

function increasingTo(bands: readonly Band[], total: number, tolerance = 0.05) {
  let prev = 0;
  for (const b of bands) {
    if (!(b.toMm > prev)) return false;
    prev = b.toMm;
  }
  return Math.abs(prev - total) <= tolerance;
}

export const lavauxSchema = z
  .strictObject({
    object: z.literal("lavaux"),
    h: num(LAVAUX_RANGES.h),
    d: num(LAVAUX_RANGES.d),
    profile: z.enum(LAVAUX_PROFILES),
    belly: num(LAVAUX_RANGES.belly),
    neck: num(LAVAUX_RANGES.neck),
    lip: num(LAVAUX_RANGES.lip),
    pattern: patternSchema,
    wall: z.union([
      z.literal(1.2),
      z.literal(1.6),
      z.literal(2),
      z.literal(2.4),
    ]),
    bands: bandsSchema(1, MAX_BANDS),
  })
  .refine((c) => increasingTo(c.bands, c.h), {
    message:
      "les bandes doivent être croissantes et finir à la hauteur du vase",
    path: ["bands"],
  });

export const cartoucheSchema = z.strictObject({
  object: z.literal("cartouche"),
  thickness: num(CARTOUCHE_RANGES.thickness),
  corner: num(CARTOUCHE_RANGES.corner),
  mode: z.enum(["relief", "gravure"]),
  depth: num(CARTOUCHE_RANGES.depth),
  layout: z.enum(["classique", "centree", "cartouche", "monogramme"]),
  plate: filament,
  ink: filament,
});

export const reliefSchema = z
  .strictObject({
    object: z.literal("relief"),
    shape: z.enum(["rond", "carre"]),
    size: num(RELIEF_RANGES.size),
    base: num(RELIEF_RANGES.base),
    relief: num(RELIEF_RANGES.relief),
    levels: int(RELIEF_RANGES.levels),
    seed: int(RELIEF_RANGES.seed),
    lake: num(RELIEF_RANGES.lake),
    bands: bandsSchema(2, MAX_BANDS),
    label: z.boolean(),
  })
  // Le sommet réel (`base + strates × Δ`) dépend des strates : le schéma ne
  // vérifie que l'ordre, le bornage ramène ensuite chaque frontière au cran.
  .refine((c) => increasingTo(c.bands, c.bands[c.bands.length - 1].toMm), {
    message: "les bandes doivent être croissantes",
    path: ["bands"],
  });

export const borneSchema = z.strictObject({
  object: z.literal("borne"),
  shape: z.enum(["pilule", "etiquette", "goutte", "pic"]),
  cap: num(BORNE_RANGES.cap),
  thickness: num(BORNE_RANGES.thickness),
  ring: z.enum(["gauche", "droite", "aucun"]),
  ringD: num(BORNE_RANGES.ringD),
  mode: z.enum(["relief", "gravure"]),
  base: filament,
  ink: filament,
});

export const SCHEMAS = {
  lavaux: lavauxSchema,
  cartouche: cartoucheSchema,
  relief: reliefSchema,
  borne: borneSchema,
} as const;

export type ParseResult =
  | { ok: true; config: StudioConfig }
  | { ok: false; error: string };

/** Valide une valeur inconnue pour l'objet donné (forme, plages, énumérations). */
export function parseConfig(
  object: StudioObjectId,
  value: unknown,
): ParseResult {
  const result = SCHEMAS[object].safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `${issue.path.join(".") || "(racine)"} : ${issue.message}`,
    };
  }
  return { ok: true, config: result.data as StudioConfig };
}
