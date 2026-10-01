import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { DotTitle } from "@/components/ui/dot-title";
import { MapFrame } from "@/components/ui/map-frame";
import { HOME } from "./contract";
import { FieldView } from "./field-view";
import { HeroCtas } from "./hero-cta";
import { HeroControls } from "./hero-controls";
import { HeroFinalPoster, HeroGhostPoster } from "./hero-poster";
import { HeroTelemetry } from "./hero-telemetry";
import { HeroVisual } from "./hero-visual";
import styles from "./home.module.css";

// Chapitre 00 « Tout relief commence par une couche. » (brief « Strates »,
// §5.1) : le héros, rendu par le serveur en entier, h1 compris (l'élément LCP :
// du texte, aucune animation d'entrée, aucun préloader). Desktop : colonnes
// 1–7 pour le texte, 7–12 pour la boîte visuelle ; mobile : tout s'empile.
//
// Le texte peut chevaucher la boîte (le canvas est derrière le DOM). Le h1 garde
// le jeton `text-hero`, plafonné par la hauteur de l'écran (home.module.css)
// pour que la section épinglée tienne dans la fenêtre. « Passer l'animation »
// est un vrai lien d'ancre vers le chapitre 01 (visible au focus) : au clavier,
// Espace et Page suivante font défiler normalement.
export function Hero() {
  const t = useTranslations("landing.hero");
  return (
    <section
      id="relief"
      data-chapter="00"
      data-home={HOME.hero}
      aria-labelledby="hero-title"
      className={styles.hero}
    >
      <FieldView name="heroField" reveal={0} anchorX={0.72} anchorY={0.5} />
      <MapFrame
        sides={["left", "bottom"]}
        coordinates={t("coords")}
        corner="top-right"
      />
      <div className={cx("s3d-page s3d-grid", styles.heroGrid)}>
        <div
          className={cx(
            "col-span-full lg:col-span-7 lg:col-start-1 lg:row-start-1",
            styles.heroText,
          )}
        >
          <p className="s3d-label text-soft">{t("kicker")}</p>
          <DotTitle
            as="h1"
            id="hero-title"
            className={cx("mt-5 font-display text-hero text-ink", styles.title)}
          >
            {t("title")}
          </DotTitle>
          <p
            className={cx(
              "mt-6 max-w-[34rem] text-lead text-soft",
              styles.lead,
            )}
          >
            {t("lead")}
          </p>
          <a
            href="#carte"
            data-home={HOME.skip}
            className="sr-only focus:not-sr-only focus:mt-4 focus:inline-block focus:rounded-field focus:bg-elevated focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink"
          >
            {t("skip")}
          </a>
          <HeroControls />
          <HeroCtas />
        </div>
        <div
          className={cx(
            "col-span-full lg:col-span-6 lg:col-start-7 lg:row-start-1",
            styles.visualColumn,
          )}
        >
          <HeroVisual ghost={<HeroGhostPoster />} final={<HeroFinalPoster />} />
          <HeroTelemetry />
        </div>
      </div>
    </section>
  );
}
