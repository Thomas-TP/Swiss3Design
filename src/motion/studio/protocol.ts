// Protocole du Worker de géométrie du Studio (brief « Strates », §6.11). Types
// seulement : lus par le Worker, par son client (worker-client.ts), par la scène
// `studio-object` et par le moteur (engine.tsx). Ajouts au brief, permis : la
// langue (étiquette du sous-verre), `separate` (éclaté), le palier d'affichage,
// les hauteurs de bandes renvoyées avec le maillage (la scène colore sans
// embarquer les générateurs de texte) et le message d'état des glyphes.
import type { StudioLocale } from "@/components/studio/scene-props";
import type {
  FilamentId,
  MeshData,
  StudioConfig,
  StudioTexts,
} from "@/lib/studio/types";

/**
 * `drag` : basse définition, au fil d'un geste. `display` : définition
 * d'affichage, au repos. `fine` : le maillage du fichier d'impression (celui de
 * l'export, jusqu'à ≈ 200 k triangles) en C2, la définition C2 en C1, calculé
 * par un second Worker pour ne jamais retarder un geste : il remplace
 * `display` quand le visiteur ne touche plus à rien (arêtes lisses).
 */
export type BuildLod = "drag" | "display" | "fine";

/** Une construction d'affichage : ce que la scène demande au Worker. */
export interface BuildJob {
  config: StudioConfig;
  /** Textes affichés (saisis ou, tant que rien n'est saisi, les exemples). */
  texts: StudioTexts;
  lod: BuildLod;
  /** 1 = C1 (≈ 38 k triangles), 2 = C2 (≈ 115 k). */
  tier: 1 | 2;
  /** Éclaté : une coque fermée par bande, jamais dans l'export. */
  separate: boolean;
  locale: StudioLocale;
}

/** Haut de bande tel que le générateur l'applique (mm depuis le plateau). */
export interface BandCut {
  filament: FilamentId;
  toMm: number;
}

export type ToWorker =
  | { t: "glyphs"; url: string }
  | ({ t: "build"; id: number } & BuildJob)
  | {
      t: "export";
      id: number;
      config: StudioConfig;
      texts: StudioTexts;
      /** Nom du fichier envoyé (informatif : l'en-tête STL porte l'empreinte). */
      name: string;
      locale: StudioLocale;
    };

export type FromWorker =
  | { t: "glyphs"; ok: boolean; message?: string }
  | {
      t: "mesh";
      id: number;
      mesh: MeshData;
      ms: number;
      bands: BandCut[];
      heightMm: number;
    }
  | {
      t: "stl";
      id: number;
      buffer: ArrayBuffer;
      triangles: number;
      bytes: number;
      ms: number;
      hash: string;
      fileName: string;
    }
  | {
      t: "error";
      id: number;
      code: "glyphs" | "build" | "export";
      message: string;
    };

/** Maillage reçu, tel que la scène le consomme. */
export interface BuiltMesh {
  mesh: MeshData;
  ms: number;
  bands: BandCut[];
  heightMm: number;
}

export interface ExportedFile {
  buffer: ArrayBuffer;
  triangles: number;
  bytes: number;
  ms: number;
  hash: string;
  fileName: string;
}

export class StudioWorkerError extends Error {
  readonly code: "glyphs" | "build" | "export";
  constructor(code: "glyphs" | "build" | "export", message: string) {
    super(message);
    this.name = "StudioWorkerError";
    this.code = code;
  }
}
