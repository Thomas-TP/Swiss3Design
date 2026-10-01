"use client";

import { Bookmark, Link2, Redo2, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

// Outils du Studio (brief « Strates », §6.7) : Annuler, Rétablir (Ctrl/⌘ + Z,
// Maj + Ctrl/⌘ + Z, pile de 50 états), « Surprenez-moi », « Copier le lien »
// (sans texte), « Garder » (« Mes créations » des Favoris). Des boutons natifs
// avec leur libellé : l'icône est décorative. Sans JavaScript, la barre
// disparaît (aucun de ces outils n'existe alors).

export interface ToolbarLabels {
  undo: string;
  redo: string;
  surprise: string;
  copy: string;
  keep: string;
  group: string;
}

export function StudioToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSurprise,
  onCopy,
  onKeep,
  labels,
  className,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSurprise: () => void;
  onCopy: () => void;
  onKeep: () => void;
  labels: ToolbarLabels;
  className?: string;
}) {
  const icon = { size: 16, strokeWidth: 1.5, "aria-hidden": true } as const;
  return (
    <fieldset
      className={cx(
        "m-0 hidden min-w-0 flex-wrap items-center gap-2 border-0 p-0 group-data-[js]/studio:flex",
        className,
      )}
    >
      <legend className="sr-only">{labels.group}</legend>
      <Button
        variant="ghost"
        size="sm"
        disabled={!canUndo}
        onClick={onUndo}
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        <Undo2 {...icon} />
        {labels.undo}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!canRedo}
        onClick={onRedo}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
      >
        <Redo2 {...icon} />
        {labels.redo}
      </Button>
      <Button variant="secondary" size="sm" onClick={onSurprise}>
        <Sparkles {...icon} />
        {labels.surprise}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCopy}>
        <Link2 {...icon} />
        {labels.copy}
      </Button>
      <Button variant="ghost" size="sm" onClick={onKeep}>
        <Bookmark {...icon} />
        {labels.keep}
      </Button>
    </fieldset>
  );
}
