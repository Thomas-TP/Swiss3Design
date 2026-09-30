// État du Studio dans l'URL (brief « Strates », §6.8).
//
//  - Fragment `#c=v1.<base64url(JSON compact)>` : clés COURTES du §6.2 (h, d,
//    p, b, n, l, m, gs/gd, wl/wa/wk, vc/va/vs, rn/ra/rt, w, bd…), ≤ 600
//    caractères, jamais envoyé au serveur. `bd` = [["bleu-leman",42],…].
//  - Paramètres GET (formulaire sans JS) : mêmes clés, bandes en
//    `bd=bleu-leman:42,vert-lavaux:108,blanc-neve:150`.
//  - AUCUN texte personnel (nom, fonction, contact, sommet) : une clé de texte
//    est REFUSÉE (`text-key`), pas ignorée ; toute clé inconnue aussi. Les
//    textes vivent en mémoire et dans sessionStorage, jamais dans l'URL.
//
// Décodage : forme validée par le schéma zod de l'objet (schemas.ts), puis
// ramenée à sa forme canonique (pas, couplages) pour que l'aller-retour soit
// stable et que le hachage d'une configuration ne dépende pas de l'écriture.
import { clampConfig, LAVAUX_RANGES, parseConfig } from "./schemas";
import type {
  Band,
  FilamentId,
  LavauxPattern,
  StudioConfig,
  StudioObjectId,
} from "./types";

export const FRAGMENT_PARAM = "c";
export const FRAGMENT_VERSION = "v1";
export const MAX_FRAGMENT_LENGTH = 600;

/** Clés de texte du §4.5 (StudioTexts) : jamais acceptées dans une URL. */
export const TEXT_KEYS: readonly string[] = [
  "name",
  "role",
  "line1",
  "line2",
  "peak",
  "text",
];

type Json = Record<string, unknown>;

export type DecodeError =
  | "empty"
  | "version"
  | "too-long"
  | "base64"
  | "json"
  | "not-object"
  | "text-key"
  | "unknown-key"
  | "invalid";

export type DecodeResult =
  | { ok: true; config: StudioConfig }
  | { ok: false; error: DecodeError; detail?: string };

// ── Table des clés courtes ───────────────────────────────────────────────────

const PATTERN_KEYS = {
  lisse: [],
  gradins: ["gs", "gd"],
  vagues: ["wl", "wa", "wk"],
  voronoi: ["vc", "va", "vs"],
  nervures: ["rn", "ra", "rt"],
} as const;

const ALL_PATTERN_KEYS: readonly string[] = Object.values(PATTERN_KEYS).flat();

const BASE_KEYS: Record<StudioObjectId, readonly string[]> = {
  lavaux: ["h", "d", "p", "b", "n", "l", "m", "w", "bd"],
  cartouche: ["t", "r", "mo", "e", "ly", "fp", "ft"],
  relief: ["sh", "s", "ba", "re", "lv", "sd", "lk", "bd", "lb"],
  borne: ["sh", "c", "t", "rg", "rd", "mo", "fb", "ft"],
};

/** Clés admises pour un objet (toutes les familles de motif pour le vase). */
function allowedKeys(object: StudioObjectId): readonly string[] {
  return object === "lavaux"
    ? [...BASE_KEYS.lavaux, ...ALL_PATTERN_KEYS]
    : BASE_KEYS[object];
}

// ── Configuration → clés courtes ─────────────────────────────────────────────

function patternToShort(p: LavauxPattern): Json {
  switch (p.kind) {
    case "lisse":
      return { m: "lisse" };
    case "gradins":
      return { m: "gradins", gs: p.step, gd: p.depth };
    case "vagues":
      return { m: "vagues", wl: p.wavelength, wa: p.amplitude, wk: p.lobes };
    case "voronoi":
      return { m: "voronoi", vc: p.cells, va: p.relief, vs: p.seed };
    case "nervures":
      return { m: "nervures", rn: p.count, ra: p.depth, rt: p.twistDeg };
  }
}

const bandsToShort = (bands: readonly Band[]) =>
  bands.map((b) => [b.filament, b.toMm]);

/** Clés courtes d'une configuration, dans l'ordre canonique du §6.2. */
export function toShortKeys(config: StudioConfig): Json {
  switch (config.object) {
    case "lavaux":
      return {
        h: config.h,
        d: config.d,
        p: config.profile,
        b: config.belly,
        n: config.neck,
        l: config.lip,
        ...patternToShort(config.pattern),
        w: config.wall,
        bd: bandsToShort(config.bands),
      };
    case "cartouche":
      return {
        t: config.thickness,
        r: config.corner,
        mo: config.mode,
        e: config.depth,
        ly: config.layout,
        fp: config.plate,
        ft: config.ink,
      };
    case "relief":
      return {
        sh: config.shape,
        s: config.size,
        ba: config.base,
        re: config.relief,
        lv: config.levels,
        sd: config.seed,
        lk: config.lake,
        bd: bandsToShort(config.bands),
        lb: config.label ? 1 : 0,
      };
    case "borne":
      return {
        sh: config.shape,
        c: config.cap,
        t: config.thickness,
        rg: config.ring,
        rd: config.ringD,
        mo: config.mode,
        fb: config.base,
        ft: config.ink,
      };
  }
}

// ── Clés courtes → configuration ─────────────────────────────────────────────

function bandsFromShort(value: unknown): Band[] | null {
  if (!Array.isArray(value)) return null;
  const out: Band[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const [filament, toMm] = item;
    if (typeof filament !== "string" || typeof toMm !== "number") return null;
    out.push({ filament: filament as FilamentId, toMm });
  }
  return out;
}

/**
 * Motif à partir des clés courtes. Les paramètres absents prennent ceux du
 * motif de référence s'il est de la même famille, sinon le défaut de la plage.
 */
function patternFromShort(
  kind: LavauxPattern["kind"],
  reference: LavauxPattern,
  pick: (key: string, fallback: unknown) => unknown,
): unknown {
  const R = LAVAUX_RANGES;
  const ref = (reference.kind === kind ? reference : {}) as Record<
    string,
    unknown
  >;
  switch (kind) {
    case "gradins":
      return {
        kind,
        step: pick("gs", ref.step ?? R.gradins.step.default),
        depth: pick("gd", ref.depth ?? R.gradins.depth.default),
      };
    case "vagues":
      return {
        kind,
        wavelength: pick("wl", ref.wavelength ?? R.vagues.wavelength.default),
        amplitude: pick("wa", ref.amplitude ?? R.vagues.amplitude.default),
        lobes: pick("wk", ref.lobes ?? R.vagues.lobes.default),
      };
    case "voronoi":
      return {
        kind,
        cells: pick("vc", ref.cells ?? R.voronoi.cells.default),
        relief: pick("va", ref.relief ?? R.voronoi.relief.default),
        seed: pick("vs", ref.seed ?? R.voronoi.seed.default),
      };
    case "nervures":
      return {
        kind,
        count: pick("rn", ref.count ?? R.nervures.count.default),
        depth: pick("ra", ref.depth ?? R.nervures.depth.default),
        twistDeg: pick("rt", ref.twistDeg ?? R.nervures.twistDeg.default),
      };
    default:
      return { kind };
  }
}
/** Valeur courte → valeur longue, par clé ; `undefined` si la clé est absente. */
function longConfig(
  object: StudioObjectId,
  short: Json,
  defaults: StudioConfig,
): unknown {
  const pick = (key: string, fallback: unknown) =>
    Object.hasOwn(short, key) ? short[key] : fallback;
  switch (object) {
    case "lavaux": {
      const d = defaults as Extract<StudioConfig, { object: "lavaux" }>;
      const kind = pick("m", d.pattern.kind) as LavauxPattern["kind"];
      const pattern = patternFromShort(kind, d.pattern, pick);
      const bands = Object.hasOwn(short, "bd")
        ? bandsFromShort(short.bd)
        : d.bands;
      return {
        object,
        h: pick("h", d.h),
        d: pick("d", d.d),
        profile: pick("p", d.profile),
        belly: pick("b", d.belly),
        neck: pick("n", d.neck),
        lip: pick("l", d.lip),
        pattern,
        wall: pick("w", d.wall),
        bands,
      };
    }
    case "cartouche": {
      const d = defaults as Extract<StudioConfig, { object: "cartouche" }>;
      return {
        object,
        thickness: pick("t", d.thickness),
        corner: pick("r", d.corner),
        mode: pick("mo", d.mode),
        depth: pick("e", d.depth),
        layout: pick("ly", d.layout),
        plate: pick("fp", d.plate),
        ink: pick("ft", d.ink),
      };
    }
    case "relief": {
      const d = defaults as Extract<StudioConfig, { object: "relief" }>;
      const bands = Object.hasOwn(short, "bd")
        ? bandsFromShort(short.bd)
        : d.bands;
      const lb = pick("lb", d.label ? 1 : 0);
      return {
        object,
        shape: pick("sh", d.shape),
        size: pick("s", d.size),
        base: pick("ba", d.base),
        relief: pick("re", d.relief),
        levels: pick("lv", d.levels),
        seed: pick("sd", d.seed),
        lake: pick("lk", d.lake),
        bands,
        label:
          lb === 1 || lb === true
            ? true
            : lb === 0 || lb === false
              ? false
              : lb,
      };
    }
    case "borne": {
      const d = defaults as Extract<StudioConfig, { object: "borne" }>;
      return {
        object,
        shape: pick("sh", d.shape),
        cap: pick("c", d.cap),
        thickness: pick("t", d.thickness),
        ring: pick("rg", d.ring),
        ringD: pick("rd", d.ringD),
        mode: pick("mo", d.mode),
        base: pick("fb", d.base),
        ink: pick("ft", d.ink),
      };
    }
  }
}

/**
 * Valide un objet de clés courtes. Les clés des autres familles de motif sont
 * refusées (`strict`, fragment) ou ignorées (GET : un formulaire envoie tous
 * ses champs). Toute clé de texte est refusée dans les deux cas.
 */
function configFromShort(
  object: StudioObjectId,
  short: Json,
  defaults: StudioConfig,
  strict: boolean,
): DecodeResult {
  const allowed = allowedKeys(object);
  const active =
    object === "lavaux"
      ? new Set<string>([
          ...BASE_KEYS.lavaux,
          ...(PATTERN_KEYS[
            (Object.hasOwn(short, "m")
              ? short.m
              : "") as keyof typeof PATTERN_KEYS
          ] ?? []),
        ])
      : null;
  for (const key of Object.keys(short)) {
    if (TEXT_KEYS.includes(key))
      return { ok: false, error: "text-key", detail: key };
    if (!allowed.includes(key))
      return { ok: false, error: "unknown-key", detail: key };
    if (strict && active && !active.has(key)) {
      return { ok: false, error: "unknown-key", detail: key };
    }
  }
  const filtered: Json = {};
  for (const [key, value] of Object.entries(short)) {
    if (!active || active.has(key)) filtered[key] = value;
  }
  const result = parseConfig(object, longConfig(object, filtered, defaults));
  if (!result.ok) return { ok: false, error: "invalid", detail: result.error };
  return { ok: true, config: clampConfig(result.config) };
}

// ── Fragment ─────────────────────────────────────────────────────────────────

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** `v1.<base64url>` : la valeur du paramètre `c` du fragment. */
export function encodeConfig(config: StudioConfig): string {
  return `${FRAGMENT_VERSION}.${toBase64Url(JSON.stringify(toShortKeys(config)))}`;
}

/** Fragment complet, `#c=v1.<base64url>`, prêt pour `history.replaceState`. */
export function configFragment(config: StudioConfig): string {
  return `#${FRAGMENT_PARAM}=${encodeConfig(config)}`;
}

/** Décode la valeur `v1.<base64url>` (sans `#c=`). */
export function decodeConfig(
  object: StudioObjectId,
  value: string,
  defaults: StudioConfig,
): DecodeResult {
  if (!value) return { ok: false, error: "empty" };
  if (value.length > MAX_FRAGMENT_LENGTH)
    return { ok: false, error: "too-long" };
  const dot = value.indexOf(".");
  if (dot < 0 || value.slice(0, dot) !== FRAGMENT_VERSION) {
    return {
      ok: false,
      error: "version",
      detail: dot < 0 ? value : value.slice(0, dot),
    };
  }
  const json = fromBase64Url(value.slice(dot + 1));
  if (json === null) return { ok: false, error: "base64" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "not-object" };
  }
  return configFromShort(object, parsed as Json, defaults, true);
}

/**
 * Décode un fragment d'URL (`#c=v1.…`, avec ou sans `#`, éventuellement suivi
 * d'autres paramètres). Les valeurs manquantes prennent celles de `defaults`.
 */
export function decodeFragment(
  object: StudioObjectId,
  hash: string,
  defaults: StudioConfig,
): DecodeResult {
  const params = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  );
  return decodeConfig(object, params.get(FRAGMENT_PARAM) ?? "", defaults);
}

// ── Paramètres GET (formulaire sans JavaScript) ──────────────────────────────

function bandsToParam(bands: readonly Band[]): string {
  return bands.map((b) => `${b.filament}:${b.toMm}`).join(",");
}

function bandsFromParam(value: string): Band[] | null {
  const out: Band[] = [];
  for (const part of value.split(",")) {
    const [filament, z, ...rest] = part.split(":");
    const toMm = Number(z);
    if (
      !filament ||
      rest.length > 0 ||
      z === undefined ||
      z === "" ||
      !Number.isFinite(toMm)
    ) {
      return null;
    }
    out.push({ filament: filament as FilamentId, toMm });
  }
  return out.length > 0 ? out : null;
}

/** Chaîne de requête GET d'une configuration (mêmes clés que le fragment). */
export function encodeSearchParams(config: StudioConfig): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toShortKeys(config))) {
    params.set(
      key,
      key === "bd" && "bands" in config
        ? bandsToParam(config.bands)
        : String(value),
    );
  }
  return params.toString();
}

export type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function entriesOf(params: SearchParamsLike): [string, string][] {
  if (params instanceof URLSearchParams) return [...params.entries()];
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    out.push([key, Array.isArray(value) ? (value[0] ?? "") : value]);
  }
  return out;
}

/**
 * Décode des paramètres GET. Les clés inconnues (bouton d'envoi, suivi…) sont
 * IGNORÉES et rapportées dans `ignored` ; une clé de texte est refusée.
 * Les valeurs numériques sont lues en nombres, `bd` en liste de bandes.
 */
export function decodeSearchParams(
  object: StudioObjectId,
  params: SearchParamsLike,
  defaults: StudioConfig,
): DecodeResult & { ignored: string[] } {
  const allowed = allowedKeys(object);
  const short: Json = {};
  const ignored: string[] = [];
  for (const [key, raw] of entriesOf(params)) {
    if (TEXT_KEYS.includes(key))
      return { ok: false, error: "text-key", detail: key, ignored };
    if (!allowed.includes(key)) {
      ignored.push(key);
      continue;
    }
    if (key === "bd") {
      const bands = bandsFromParam(raw);
      if (!bands) return { ok: false, error: "invalid", detail: "bd", ignored };
      short[key] = bandsToShort(bands);
    } else if (key === "lb") {
      short[key] = raw === "1" || raw === "true" || raw === "on" ? 1 : 0;
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      short[key] = Number(raw);
    } else {
      short[key] = raw; // une valeur vide ou non numérique échoue au schéma
    }
  }
  return { ...configFromShort(object, short, defaults, false), ignored };
}
