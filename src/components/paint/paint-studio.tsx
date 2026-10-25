"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicCustomColor } from "@/lib/filament/public-stock";
import type { PaintDocument } from "@/lib/paint3d/document";
import { paletteRemap } from "@/lib/paint3d/palette";
import {
  applyFilePaint,
  openProject,
  paintedPreview,
  projectMatters,
  projectSummary,
} from "@/lib/paint3d/project";
import {
  bambuPresetFor,
  GENERIC_PRESET,
  type BambuTemplate,
} from "@/lib/paint3d/bambu-project";
import { write3mf } from "@/lib/paint3d/write3mf";
import { VIEWER_FALLBACK_COLOR } from "@/components/catalog/viewer-props";
import { PaintDialog } from "./paint-dialog";
import type { PaintNotice, PaintProject, PaintSourceFile } from "./types";

// Atelier 3D de « Sur mesure » : il possède le document de peinture du fichier
// du visiteur (src/lib/paint3d), le garde d'une ouverture à l'autre, suit la
// palette choisie dans le formulaire (une couleur retirée redevient la base,
// une couleur déplacée garde ses zones) et remonte au formulaire, à chaque
// fermeture, l'aperçu peint, le résumé et l'export 3MF. Monté dès que le fichier
// est lu : un 3MF déjà peint (MakerWorld) montre ses couleurs tout de suite,
// associées aux couleurs du stock.

/** Teintes de chaque emplacement (le blanc neutre du viewer sans couleur choisie). */
function paletteFrom(
  stock: readonly PublicCustomColor[] | null,
  ids: readonly string[],
): string[][] {
  if (ids.length === 0) return [[VIEWER_FALLBACK_COLOR]];
  return ids.map((id) => [
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
  /** Palette (ids du stock), dans l'ordre des emplacements : la 1re est la base. */
  refs: readonly string[];
  onRefsChange: (refs: string[]) => void;
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
  refs,
  onRefsChange,
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
  /** Couleurs du fichier proposées dans l'atelier (null : aucune, ou reprises). */
  const [fileOffer, setFileOffer] = useState<{
    count: number;
    apply: () => void;
  } | null>(null);
  // Dernières valeurs lues par les rappels (sans relancer les effets).
  const latest = useRef({
    refs,
    stock,
    onProject,
    onRefsChange,
    onNotice,
    fileName,
  });
  useEffect(() => {
    latest.current = {
      refs,
      stock,
      onProject,
      onRefsChange,
      onNotice,
      fileName,
    };
  });
  /** Palette déjà appliquée aux états du document. */
  const applied = useRef<readonly string[]>([]);
  /** Palette du dernier projet remonté au formulaire. */
  const reported = useRef<string | null>(null);
  const origin = useRef({ file: false, painted: false });
  const openedAt = useRef<number | null>(null);
  const stockReady = stock !== null;

  const paletteOf = useCallback(
    (ids: readonly string[]) => paletteFrom(latest.current.stock, ids),
    [],
  );
  const palette = useMemo(() => paletteFrom(stock, refs), [stock, refs]);

  const report = useCallback(
    (current: PaintDocument) => {
      const { refs: ids, fileName: name } = latest.current;
      reported.current = ids.join(",");
      const matters = projectMatters(current, ids);
      const from = origin.current;
      const summary = projectSummary(
        current,
        ids,
        from.file && from.painted
          ? "both"
          : from.file
            ? "file"
            : from.painted
              ? "painted"
              : "none",
      );
      const showPainted = matters || from.file;
      const title = name.replace(/\.[^.]+$/, "") || "Kreya";
      latest.current.onProject({
        preview: showPainted
          ? {
              format: "painted",
              ...paintedPreview(current),
              palette: paletteOf(ids),
            }
          : null,
        summary,
        matters,
        scale: current.scale,
        version: current.version,
        export3mf: async (onProgress) => {
          // Teinte de chaque filament (la première d'une bobine co-extrudée).
          const colors = paletteOf(ids).map((hexes) => hexes[0]);
          const stockNow = latest.current.stock ?? [];
          // Projet Bambu Studio : chaque filament avec le profil de sa
          // référence. Le modèle de réglages (≈ 7 Ko compressés) n'est chargé
          // qu'au moment d'envoyer.
          const { default: template } =
            await import("@/lib/paint3d/bambu-template.json");
          const filaments = colors.map((hex, i) => {
            const ref = stockNow.find((c) => c.id === ids[i]);
            return {
              hex,
              preset: ref
                ? bambuPresetFor(ref.brand, ref.range)
                : GENERIC_PRESET,
            };
          });
          return write3mf(current, {
            title,
            onProgress,
            colors: ids.length ? colors : [],
            bambu: { template: template as BambuTemplate, filaments },
          });
        },
      });
    },
    [paletteOf],
  );

  // Ouverture du fichier (une fois le stock connu : les couleurs d'un fichier
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
          applied.current = latest.current.refs;
          setDoc(opened.doc);
          setFailed(false);
          const { fileRefs, filePaint, merged } = opened;
          if (fileRefs && filePaint) {
            // Couleurs du fichier (MakerWorld : peinture, filament par pièce)
            // reprises d'office, une étape annulable ; « Garder une seule
            // couleur » les retire, « Reprendre » les remet.
            const notify = (notice: PaintNotice) =>
              latest.current.onNotice?.(notice);
            const apply = () => {
              applyFilePaint(opened.doc, filePaint);
              origin.current.file = true;
              applied.current = fileRefs;
              setFileOffer(null);
              latest.current.onRefsChange(fileRefs);
              notify({
                kind: "fileColorsApplied",
                count: fileRefs.length,
                merged,
                revert,
              });
              window.setTimeout(() => report(opened.doc), 0);
            };
            const revert = () => {
              opened.doc.beginStep();
              for (const t of filePaint.keys()) opened.doc.setNode(t, 0);
              opened.doc.endStep();
              origin.current.file = false;
              const single = fileRefs.slice(0, 1);
              applied.current = single;
              setFileOffer({ count: fileRefs.length, apply });
              latest.current.onRefsChange(single);
              notify({
                kind: "fileColors",
                count: fileRefs.length,
                merged,
                apply,
              });
              window.setTimeout(() => report(opened.doc), 0);
            };
            apply();
          } else {
            setFileOffer(null);
            latest.current.onNotice?.(null);
          }
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

  // Palette changée dans le formulaire : les zones suivent leur couleur.
  const refsKey = refs.join(",");
  useEffect(() => {
    if (!doc) return;
    const before = applied.current;
    if (before.join(",") !== refsKey) {
      const after = refsKey ? refsKey.split(",") : [];
      applied.current = after;
      doc.remapStates(paletteRemap(before, after));
    }
    // Couleurs reprises du fichier, remplacées, ajoutées : le formulaire suit.
    if (!open && reported.current !== refsKey) report(doc);
  }, [doc, refsKey, open, report]);

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

  /** Remplace la couleur d'un emplacement : ses zones gardent leur place. */
  const replaceRef = useCallback((slot: number, id: string) => {
    const next = [...latest.current.refs];
    if (slot >= next.length || next.includes(id)) return;
    next[slot] = id;
    applied.current = next;
    latest.current.onRefsChange(next);
  }, []);

  if (!open) return null;
  return (
    <PaintDialog
      doc={doc}
      failed={failed}
      fileName={fileName}
      stock={stock ?? []}
      selectable={selectable}
      refs={refs}
      palette={palette}
      maxColors={maxColors}
      gramsPerPiece={gramsPerPiece}
      plate={plate}
      onRefsChange={onRefsChange}
      onReplaceRef={replaceRef}
      fileOffer={fileOffer}
      onClose={onClose}
    />
  );
}
