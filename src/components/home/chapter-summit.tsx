import { useLocale, useTranslations } from "next-intl";
import { DotTitle } from "@/components/ui/dot-title";
import { TEXT_LIMITS } from "@/lib/studio/text/fields";
import { HOME_DATA } from "./home-data.generated";
import type { HomeLocale } from "./home-data-types";
import { SummitInput, SummitProvider, SummitStage } from "./summit";
import { statsItems, type UnitsTranslator } from "./stats-items";
import styles from "./home.module.css";

// Chapitre 02 « Votre nom, en relief. Littéralement. » (brief « Strates »,
// §7.5), ton « encre » : deux moitiés pleine largeur, le texte et le champ à
// gauche (fond encre du DOM), la vue du sous-verre à droite (un bloc encre dont
// la vue est le fils direct : une fois prête, elle peint elle-même le fond). Le
// chapitre n'est pas un <Chapter> : son en-tête vit dans la moitié encre.
//
// L'étiquette et les chiffres initiaux sont ceux de l'exemple (home-data-build
// les calcule avec les fonctions du Studio, home-data.generated.ts les fige) ; le
// client les remplace quand le visiteur tape. Le lien du bouton rouge porte la
// configuration du sous-verre (jamais de texte : il arrive au Studio par
// sessionStorage).
export function ChapterSummit() {
  const locale = useLocale() as HomeLocale;
  const t = useTranslations("landing.summit");
  const tex = useTranslations("studioCore.examples");
  const tu = useTranslations("studioCore.units");

  const { reliefConfig, reliefHref } = HOME_DATA;
  const initial = HOME_DATA.summit[locale];
  const initialItems = statsItems(initial.stats, locale, tu as UnitsTranslator);

  return (
    <section
      id="sommet"
      data-chapter="02"
      aria-labelledby="sommet-title"
      className={`relative scroll-mt-24 ${styles.summit}`}
    >
      <SummitProvider
        config={reliefConfig}
        example={tex("peak")}
        initialLabel={initial.label}
        initialItems={initialItems}
      >
        <div data-tone="ink" className={styles.summitText}>
          <p className="s3d-label text-soft">
            <span className="text-ink">02</span>
            <span aria-hidden="true" className="mx-2 text-iso-index">
              ·
            </span>
            {t("eyebrow")}
          </p>
          <DotTitle
            as="h2"
            id="sommet-title"
            className={`mt-4 max-w-[14ch] font-display text-display text-ink ${styles.summitTitle}`}
          >
            {t("title")}
          </DotTitle>
          <p className="mt-6 max-w-[48ch] text-lead text-soft">{t("lead")}</p>
          <SummitInput href={reliefHref} maxLength={TEXT_LIMITS.peak} />
        </div>
        <div data-tone="ink" className={styles.summitStage}>
          <SummitStage
            poster={
              // Le chapitre est toujours « encre » : l'affiche sombre, dont les
              // filets sont éclaircis pour se détacher du fond.
              <img
                src="/posters/relief-default-dark.svg"
                alt=""
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
              />
            }
          />
        </div>
      </SummitProvider>
      <p className="sr-only">{t("poster")}</p>
    </section>
  );
}
