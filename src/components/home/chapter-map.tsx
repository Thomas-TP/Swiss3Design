import { useLocale, useTranslations } from "next-intl";
import { Chapter } from "@/components/ui/chapter";
import { formatInteger, formatMm } from "@/lib/studio/format";
import type { HeroData } from "./hero-data";
import { FieldView } from "./field-view";
import { HeroExplodedPoster } from "./hero-poster";
import { MapBody } from "./map-body";
import styles from "./home.module.css";

// Chapitre 01 « Une couleur par altitude. » (brief « Strates », §7.5) : le
// champ de courbes de niveau en fond (WebGL en C2, SVG ailleurs), le vase
// éclaté et une étiquette par bande. L'en-tête et le chapeau sont rendus par le
// serveur ; les chiffres du chapeau (hauteur, nombre de couches) sortent de
// `computeStats(HERO_CONFIG)` via les données du héros.
export function ChapterMap({ data }: { data: HeroData }) {
  const locale = useLocale();
  const t = useTranslations("landing.map");
  return (
    <Chapter
      id="carte"
      number="01"
      title={t("title")}
      eyebrow={t("eyebrow")}
      intro={
        <span className={styles.halo}>
          {t("intro", {
            height: formatMm(data.heightMm, locale),
            layers: formatInteger(data.layers, locale),
          })}
        </span>
      }
      headerClassName="relative z-[1]"
    >
      <FieldView
        name="mapField"
        reveal={1}
        anchorX={0.7}
        anchorY={0.5}
        poster
      />
      <MapBody explodedPoster={<HeroExplodedPoster />} />
    </Chapter>
  );
}
