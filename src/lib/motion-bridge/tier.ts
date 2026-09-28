// Détection de capacité C0–C2 (brief « Strates », §3.6), légère et sans import
// lourd : lancée après l'hydratation, jamais côté serveur (qui sert tout le
// monde en C0, avec les posters). La classification est une fonction pure,
// testée ; la lecture de l'environnement est isolée à côté.
import type { Capability } from "./types";

/** sessionStorage : une perte de contexte WebGL vaut C0 jusqu'à la fin de la session. */
export const WEBGL_LOST_KEY = "s3d-webgl-lost";

export interface CapabilityEnv {
  /** Un contexte WebGL2 matériel a pu être créé (sans repli logiciel). */
  webgl2: boolean;
  saveData: boolean;
  /** navigator.deviceMemory (Go), absent hors Chromium. */
  deviceMemory?: number;
  contextLostInSession: boolean;
  coarsePointer: boolean;
  /** Largeur de la fenêtre, px CSS. */
  width: number;
  hardwareConcurrency?: number;
}

/** Règles du §3.6, dans l'ordre : C0 d'abord, puis C1, sinon C2. */
export function classifyCapability(env: CapabilityEnv): Capability {
  if (
    !env.webgl2 ||
    env.saveData ||
    (env.deviceMemory !== undefined && env.deviceMemory <= 2) ||
    env.contextLostInSession
  )
    return 0;
  if (
    env.coarsePointer ||
    env.width < 1024 ||
    (env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 4)
  )
    return 1;
  return 2;
}

/** Palier suivant vers le bas : C2 → C1 (DPR 1,5, LOD mobile), C1 → C0 (posters). */
export function downgrade(capability: Capability): Capability {
  return capability === 2 ? 1 : 0;
}

// ── Déclassement automatique ─────────────────────────────────────────────────

export interface FrameMonitor {
  /**
   * Durée d'une frame rendue (ms). Renvoie true une seule fois, quand les
   * `samples` premières frames sont réunies et que leur médiane dépasse le
   * seuil ; ensuite, plus rien (une mesure par palier).
   */
  push(frameMs: number): boolean;
  reset(): void;
}

/**
 * Médiane des 60 premières frames > 22 ms ⇒ déclasser (§3.6). Une frame
 * isolée après un repos (rendu à la demande) n'est pas une mesure : l'appelant
 * ne pousse que les écarts entre deux frames rendues consécutivement ; les
 * valeurs aberrantes (onglet masqué, pause du débogueur) sont écartées ici.
 */
export function createFrameMonitor({
  samples = 60,
  thresholdMs = 22,
  maxFrameMs = 250,
}: {
  samples?: number;
  thresholdMs?: number;
  maxFrameMs?: number;
} = {}): FrameMonitor {
  let values: number[] = [];
  let done = false;
  return {
    push(frameMs) {
      if (done || !Number.isFinite(frameMs) || frameMs <= 0) return false;
      if (frameMs > maxFrameMs) return false;
      values.push(frameMs);
      if (values.length < samples) return false;
      done = true;
      return median(values) > thresholdMs;
    },
    reset() {
      values = [];
      done = false;
    },
  };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Lecture de l'environnement (navigateur) ──────────────────────────────────

interface NavigatorHints {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

function probeWebgl2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    // failIfMajorPerformanceCaveat : un rendu logiciel (SwiftShader, pilote
    // en liste noire) vaut C0, il ne tiendrait pas une scène à 60 i/s.
    const gl = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return false;
    // Rend le contexte tout de suite : le Stage n'en veut qu'un par page.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function webglLostInSession(): boolean {
  try {
    return sessionStorage.getItem(WEBGL_LOST_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWebglLost() {
  try {
    sessionStorage.setItem(WEBGL_LOST_KEY, "1");
  } catch {
    // Stockage bloqué : le pont retient la perte pour la page en cours.
  }
}

function matches(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function readCapabilityEnv(): CapabilityEnv {
  const nav = navigator as Navigator & NavigatorHints;
  const contextLostInSession = webglLostInSession();
  return {
    // Inutile de créer un contexte si la session l'a déjà perdu.
    webgl2: !contextLostInSession && probeWebgl2(),
    saveData: nav.connection?.saveData === true,
    deviceMemory:
      typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    contextLostInSession,
    coarsePointer: matches("(pointer: coarse)"),
    width: window.innerWidth,
    hardwareConcurrency:
      typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0
        ? nav.hardwareConcurrency
        : undefined,
  };
}

// Une détection par chargement de page : quitter puis retrouver les pages
// vitrine ne refait pas la sonde WebGL et n'efface pas un déclassement.
let detected: Capability | null = null;

/** Capacité de l'appareil, mémorisée ; 0 côté serveur. */
export function detectCapability(): Capability {
  if (typeof window === "undefined") return 0;
  detected ??= classifyCapability(readCapabilityEnv());
  return detected;
}

/**
 * Déclasse la capacité mémorisée (frames trop lentes, perte de contexte) et
 * renvoie la nouvelle valeur. L'appelant la reporte dans le pont.
 */
export function lowerDetectedCapability(to?: Capability): Capability {
  const from = detected ?? detectCapability();
  detected =
    to === undefined ? downgrade(from) : (Math.min(from, to) as Capability);
  return detected;
}

/** Réservé aux tests. */
export function resetCapabilityForTests() {
  detected = null;
}
