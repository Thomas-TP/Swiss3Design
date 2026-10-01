"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { HOME_VIEW_ATTR } from "./contract";
import { useHomeConfig } from "./home-config-context";
import { HeroChange, HeroRuler } from "./hero-telemetry";
import type { PrintHeroProps } from "./stage-props";
import { useHomeMotion, useHomeView } from "./use-home-motion";
import { useStaticPoster } from "./use-static-poster";
import styles from "./home.module.css";

// La boîte visuelle du héros (brief « Strates », §5.1, §5.5, §5.7) : une vue du
// Stage (`print-hero`) dont les enfants sont les deux posters SSR (le dessin,
// puis la matière), l'étiquette d'honnêteté et, sur mobile, la réglette Z.
//
// Trois états, un seul DOM :
//  - premier paint, ou capacité C0 en mouvement complet : le poster « dessin »
//    (anneaux fantômes), qui devient « matière » en 240 ms une fois la
//    détection faite (appareil sans WebGL) ;
//  - mouvement réduit : le poster « matière », tout de suite, sans vue du Stage
//    (three n'est jamais téléchargé pour le héros) ;
//  - WebGL : la vue s'enregistre, le Stage rend une première frame identique au
//    poster, le poster s'efface, la chorégraphie joue l'impression.
// Les contrôles de palette et de motif changent les props de la vue (vague,
// réimpression) ou, en 2D, recolorent le poster recalculé côté client.
export function HeroVisual({
  ghost,
  final,
}: {
  ghost: ReactNode;
  final: ReactNode;
}) {
  const t = useTranslations("landing.hero");
  const { data, palette, pattern, config } = useHomeConfig();
  const { reduced, capability, staticPoster } = useHomeMotion();
  const ref = useRef<HTMLElement>(null);

  const props = useMemo<PrintHeroProps>(
    () => ({
      mode: "hero",
      palette,
      pattern,
      config,
      patterns: data.patterns,
      bands3: data.palettes.leman,
    }),
    [data, palette, pattern, config],
  );
  const live = !reduced && capability !== null && capability >= 1;
  useHomeView(ref, "print-hero", props, {
    enabled: live,
    // Épinglé (C2, ≥ 1024 × 768) : le rectangle est relu à chaque frame.
    liveRect: capability === 2,
    // Mobile : figé en image au repos, le défilement natif ne « nage » pas.
    bakeWhenIdle: capability === 1,
    priority: 1,
  });
  const custom = useStaticPoster("final", staticPoster);

  return (
    <figure
      ref={ref}
      data-stage-view="print-hero"
      {...{ [HOME_VIEW_ATTR]: "hero" }}
      className={cx(styles.visual, staticPoster && styles.static)}
    >
      <figcaption className="sr-only">{t("visual")}</figcaption>
      <div className="s3d-poster absolute inset-0" aria-hidden="true">
        <div className={styles.ghost}>{ghost}</div>
        <div className={styles.final}>{custom ?? final}</div>
      </div>
      <p className={cx("s3d-label normal-case", styles.label)}>{t("label")}</p>
      <HeroChange />
      {capability === 1 ? <HeroRuler /> : null}
    </figure>
  );
}
