"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicCustomColor } from "@/lib/filament/public-stock";
import type { PaintDocument } from "@/lib/paint3d/document";
import { printedPalette, slotRemap } from "@/lib/paint3d/palette";
import {
  openProject,
  paintedPreview,
  projectMatters,
  projectSummary,
} from "@/lib/paint3d/project";
import { paintStats } from "@/lib/paint3d/stats";
import {
  bambuPresetFor,
  GENERIC_PRESET,
  type BambuTemplate,
} from "@/lib/paint3d/bambu-project";
import { write3mf } from "@/lib/paint3d/write3mf";
import { VIEWER_FALLBACK_COLOR } from "@/components/catalog/viewer-props";
import { PaintDialog } from "./paint-dialog";
import { newSlot } from "./slots";
import type {
  ColorSetup,
  PaintNotice,
  PaintProject,
  PaintSourceFile,
} from "./types";

// Atelier 3D de « Sur mesure » : il possède le document de peinture du fichier
// du visiteur (src/lib/paint3d), le garde d'une ouverture à l'autre et remonte au
// formulaire, à chaque changement, l'aperçu peint, le résumé et l'export 3MF.
//
// Les zones appartiennent aux EMPLACEMENTS (filaments 1 à 4), jamais aux
// couleurs (25.10.2026, comme Bambu Studio) : changer la couleur d'un
// emplacement, passer d'une à plusieurs couleurs et revenir ne touchent pas à la
// peinture. Seul le retrait d'un emplacement rend ses zones à la couleur
// principale. Un 3MF déjà peint (MakerWorld) s'ouvre avec ses zones, un
// emplacement par filament, chacun dans la couleur du stock la plus proche.

/** Teintes de chaque emplacement (le blanc neutre du viewer sans couleur choisie). */
function tintsOf(
  stock: readonly PublicCustomColor[] | null,
  refs: readonly string[],
): string[][] {
  if (refs.length === 0) return [[VIEWER_FALLBACK_COLOR]];
  return refs.map((id) => [
    ...(stock?.find((c) => c.id === id)?.hexes ?? [VIEWER_FALLBACK_COLOR]),
  ]);
}

export interface PaintStudioProps {
  source: PaintSourceFile;
  /** Change avec le fichier : un nouveau document. */
  sourceKey: string;
  fileName: string;
  /** Couleurs « sur mesure » du stock (null tant qu'elles se chargent). */
  stock: readonly PublicCustomColor[] | null;
  /** Couleurs assez fournies pour la pièce. */
  selectable: ReadonlySet<string>;
  setup: ColorSetup;
  onSetupChange: (setup: ColorSetup) => void;
  maxColors: number;
  /** Poids estimé d'une pièce à la taille du fichier (g), ou null. */
  gramsPerPiece: number | null;
  /** Côté du plateau (mm). */
  plate: number;
  open: boolean;
  onClose: () => void;
  onProject: (project: PaintProject | null) => void;
  onNotice?: (notice: PaintNotice | null) => void;
}

export function PaintStudio({
  source,
  sourceKey,
  fileName,
  stock,
  selectable,
  setup,
  onSetupChange,
  maxColors,
  gramsPerPiece,
  plate,
  open,
  onClose,
  onProject,
  onNotice,
}: PaintStudioProps) {
  const [doc, setDoc] = useState<PaintDocument | null>(null);
  const [failed, setFailed] = useState(false);
  // Dernières valeurs lues par les rappels (sans relancer les effets).
  const latest = useRef({
    setup,
    stock,
    onProject,
    onSetupChange,
    onNotice,
    fileName,
  });
  useEffect(() => {
    latest.current = {
      setup,
      stock,
      onProject,
      onSetupChange,
      onNotice,
      fileName,
    };
  });
  /** Emplacements (identifiants) dont les états du document suivent l'ordre. */
  const applied = useRef<readonly number[]>([]);
  const origin = useRef({ file: false, painted: false });
  const openedAt = useRef<number | null>(null);
  const stockReady = stock !== null;

  const report = useCallback((current: PaintDocument) => {
    const { setup: now, fileName: name } = latest.current;
    const slotRefs = now.slots.map((slot) => slot.ref);
    const { refs, states } = printedPalette(slotRefs, now.several);
    const matters = projectMatters(current, slotRefs, now.several);
    const from = origin.current;
    const summary = projectSummary(
      current,
      slotRefs,
      now.several,
      from.file && from.painted
        ? "both"
        : from.file
          ? "file"
          : from.painted
            ? "painted"
            : "none",
    );
    const perSlot = paintStats(current, Math.max(1, slotRefs.length));
    const total = perSlot.totalArea || 1;
    const title = name.replace(/\.[^.]+$/, "") || "Kreya";
    latest.current.onProject({
      preview: matters
        ? {
            format: "painted",
            ...paintedPreview(current, states),
            palette: tintsOf(latest.current.stock, refs),
          }
        : null,
      summary,
      matters,
      scale: current.scale,
      slotShares: slotRefs.map((_, i) => (perSlot.areaBySlot[i] ?? 0) / total),
      version: current.version,
      export3mf: async (onProgress) => {
        // Teinte de chaque filament imprimé (la première d'une bobine co-extrudée).
        const colors = tintsOf(latest.current.stock, refs).map(
          (hexes) => hexes[0],
        );
        const stockNow = latest.current.stock ?? [];
        // Projet Bambu Studio : chaque filament avec le profil de sa
        // référence. Le modèle de réglages (≈ 7 Ko compressés) n'est chargé
        // qu'au moment d'envoyer.
        const { default: template } =
          await import("@/lib/paint3d/bambu-template.json");
        const filaments = colors.map((hex, i) => {
          const ref = stockNow.find((c) => c.id === refs[i]);
          return {
            hex,
            preset: ref ? bambuPresetFor(ref.brand, ref.range) : GENERIC_PRESET,
          };
        });
        return write3mf(current, {
          title,
          onProgress,
          colors: refs.length ? colors : [],
          states,
          bambu: { template: template as BambuTemplate, filaments },
        });
      },
    });
  }, []);

  // Ouverture du fichier (une fois le stock connu : les filaments d'un fichier
  // peint prennent la teinte du stock la plus proche).
  // oxlint-disable exhaustive-deps -- un document par fichier ; le stock et les couleurs choisies sont lus à cet instant
  useEffect(() => {
    if (!stockReady) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      const colors = (latest.current.stock ?? []).filter((c) =>
        selectable.has(c.id),
      );
      openProject(source, colors, maxColors).then(
        (opened) => {
          if (!alive) return;
          origin.current = { file: false, painted: false };
          setFailed(false);
          if (opened.fileRefs) {
            // Les zones du fichier sont en place : un emplacement par filament.
            const slots = opened.fileRefs.map(newSlot);
            applied.current = slots.map((slot) => slot.id);
            origin.current.file = true;
            latest.current.setup = { slots, several: true };
            latest.current.onSetupChange({ slots, several: true });
            latest.current.onNotice?.({
              kind: "fileColors",
              count: opened.fileRefs.length,
              merged: opened.merged,
            });
          } else {
            applied.current = latest.current.setup.slots.map((s) => s.id);
            latest.current.onNotice?.(null);
          }
          setDoc(opened.doc);
          report(opened.doc);
        },
        (error: unknown) => {
          if (!alive) return;
          console.error("[atelier 3D] fichier illisible", error);
          setFailed(true);
          latest.current.onNotice?.({ kind: "error" });
          latest.current.onProject(null);
        },
      );
    }, 30);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [sourceKey, stockReady]);
  // oxlint-enable exhaustive-deps

  // Emplacement retiré : ses zones reviennent à la couleur principale, les
  // suivants descendent d'un cran. Une couleur changée ne touche à rien.
  const idsKey = setup.slots.map((slot) => slot.id).join(",");
  const refsKey = setup.slots.map((slot) => slot.ref).join(",");
  useEffect(() => {
    if (!doc) return;
    const after = idsKey ? idsKey.split(",").map(Number) : [];
    const before = applied.current;
    if (before.join(",") !== idsKey) {
      applied.current = after;
      const map = slotRemap(before, after);
      if (map.some((to, from) => to !== from)) doc.remapStates(map);
    }
    if (!open) report(doc);
  }, [doc, idsKey, refsKey, setup.several, open, report]);

  // Fermeture : le formulaire reçoit l'état du projet.
  useEffect(() => {
    if (!doc) return;
    if (open) {
      openedAt.current = doc.version;
      return;
    }
    if (openedAt.current === null) return;
    if (doc.version !== openedAt.current) origin.current.painted = true;
    openedAt.current = null;
    report(doc);
  }, [open, doc, report]);

  const palette = useMemo(
    () =>
      tintsOf(
        stock,
        setup.several
          ? setup.slots.map((slot) => slot.ref)
          : setup.slots.slice(0, 1).map((slot) => slot.ref),
      ),
    [stock, setup],
  );

  if (!open) return null;
  return (
    <PaintDialog
      doc={doc}
      failed={failed}
      fileName={fileName}
      stock={stock ?? []}
      selectable={selectable}
      setup={setup}
      palette={palette}
      maxColors={maxColors}
      gramsPerPiece={gramsPerPiece}
      plate={plate}
      onSetupChange={onSetupChange}
      onClose={onClose}
    />
  );
}
