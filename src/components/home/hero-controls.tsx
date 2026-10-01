"use client";

import { useTranslations } from "next-intl";
import { ChipRadio } from "@/components/ui/chip";
import { filamentHex } from "@/lib/studio/filaments";
import { PALETTE_KEYS, PATTERN_KEYS, type HeroPatternKey } from "./hero-data";
import { useHomeConfig } from "./home-config-context";
import styles from "./home.module.css";

// Les deux gestes de personnalisation du héros (brief « Strates », §5.6) :
// Palette (quatre puces, chacune montre ses bandes) et Motif (trois puces,
// chacune son pictogramme). Deux fieldset de boutons radio NATIFS, étiquetés,
// navigables aux flèches, rendus par le serveur : sans JavaScript ils ne font
// rien, avec JavaScript ils changent le vase sous les yeux (vague de couleur
// pour la palette, réimpression pour le motif) et le lien « Régler un objet »
// suit. Le premier geste envoie `Hero Customized` (home-config-context).
// Mobile : une rangée défilante par groupe, à l'horizontale.

/** Pictogrammes des motifs (grille 24, trait 1,5, extrémités carrées). */
function PatternIcon({ pattern }: { pattern: HeroPatternKey }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {pattern === "gradins" && <path d="M3 20h5v-4h5v-4h5V8h3" />}
      {pattern === "vagues" && (
        <path d="M2 14c2.5-7 5-7 7.5 0s5 7 7.5 0c1.2-3.2 2.4-4.6 5-4.6" />
      )}
      {pattern === "voronoi" && (
        <>
          <path d="M4 9.5 9 4.5l8 1.5 3.5 6-3 7.5-8.5 1.5L4 16z" />
          <path d="M9 4.5 11 12l-7 4M11 12l6-6M11 12l6 7.5M11 12l-2 8.5" />
        </>
      )}
    </svg>
  );
}

export function HeroControls() {
  const t = useTranslations("landing.hero");
  const tPalettes = useTranslations("studioCore.palettes");
  const tPatterns = useTranslations("studioCore.patterns");
  const { data, palette, pattern, setPalette, setPattern } = useHomeConfig();

  return (
    <div className={styles.controls}>
      <fieldset className={styles.group}>
        <legend className="s3d-label mb-2 text-soft">{t("palette")}</legend>
        <div className={styles.chips}>
          {PALETTE_KEYS.map((key) => (
            <ChipRadio
              key={key}
              name="hero-palette"
              value={key}
              checked={palette === key}
              onChange={() => setPalette(key)}
            >
              <span aria-hidden="true" className={styles.bands}>
                {data.palettes[key].map((band, index) => (
                  <span
                    key={`${band.filament}-${index}`}
                    className={styles.band}
                    style={{ backgroundColor: filamentHex(band.filament) }}
                  />
                ))}
              </span>
              {tPalettes(key)}
            </ChipRadio>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.group}>
        <legend className="s3d-label mb-2 text-soft">{t("pattern")}</legend>
        <div className={styles.chips}>
          {PATTERN_KEYS.map((key) => (
            <ChipRadio
              key={key}
              name="hero-pattern"
              value={key}
              checked={pattern === key}
              onChange={() => setPattern(key)}
            >
              <PatternIcon pattern={key} />
              {tPatterns(key)}
            </ChipRadio>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
