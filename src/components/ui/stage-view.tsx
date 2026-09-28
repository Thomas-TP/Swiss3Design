"use client";

import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";
import type { SceneId, StageViewDescriptor } from "@/lib/motion-bridge/types";
import { useStageView } from "@/lib/motion-bridge/use-stage-view";
import { cx } from "./cx";

// Vue du Stage (brief « Strates », §4.4) : le conteneur DOM, transparent, qui
// COUVRE toute la section qui l'héberge (ou vit dans une section
// transparente), avec son poster SSR en enfant `.s3d-poster`. Le SSR rend le
// poster, rien d'autre : c'est l'état C0, complet et exact. Après
// l'hydratation, useStageView déclare la vue au pont ; la SiteShell ne charge
// le Stage (three) que s'il existe au moins une vue, en capacité ≥ C1 et sans
// perte de contexte. À sa première frame, le Stage pose
// data-stage-ready="true" sur ce conteneur : le poster s'efface en 240 ms
// (globals.css) et une section tonale devient transparente (la vue peint
// alors le fond de ton, clear: "tone"). Perte de contexte : l'attribut est
// retiré, le poster revient.
//
// Le canvas est aria-hidden : ce qui compte doit exister en DOM (poster,
// légende, résumé vivant de l'appelant). Une vue interactive (orbite) prend
// le focus (flèches pour tourner) et bloque le geste tactile natif sur elle
// seule (`touch-action: none`, §3.5) ; l'appelant peut préférer `pan-y`
// (rotation horizontale sans capturer le défilement vertical).

type ViewOptions = Pick<
  StageViewDescriptor,
  "clear" | "liveRect" | "bakeWhenIdle" | "interactive" | "priority"
>;

export function StageView<P>({
  scene,
  props,
  poster,
  label,
  touch = "none",
  className,
  children,
  ...options
}: Partial<ViewOptions> & {
  scene: SceneId;
  /** Instantané immuable passé à la scène (remplacer l'objet, ne pas le muter). */
  props: P;
  /** Poster SSR (SVG inline ou <img>), visible tant que le Stage n'a pas rendu. */
  poster?: ReactNode;
  /** Nom accessible d'une vue interactive (défaut : « Aperçu 3D : flèches pour tourner »). */
  label?: string;
  touch?: "none" | "pan-y";
  className?: string;
  /** Surimpressions DOM (étiquettes, boutons « Tourner »), au-dessus du canvas. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("shell.stage");
  const interactive = options.interactive ?? false;
  useStageView(ref, scene, props, options);

  return (
    <div
      ref={ref}
      data-stage-view={scene}
      // Vue interactive : un objet 3D que l'on fait tourner au clavier, d'où
      // le rôle « application » (les flèches vont à la scène, pas au lecteur).
      role={interactive ? "application" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? (label ?? t("interactive")) : undefined}
      className={cx(
        "relative",
        interactive && (touch === "none" ? "touch-none" : "touch-pan-y"),
        className,
      )}
    >
      {poster ? (
        <div className="s3d-poster absolute inset-0">{poster}</div>
      ) : null}
      {children}
    </div>
  );
}
