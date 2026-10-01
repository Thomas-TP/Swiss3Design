import { useLocale, useTranslations } from "next-intl";
import { DotTitle } from "@/components/ui/dot-title";
import { peakLabel } from "@/lib/studio/objects/relief-model";
import { RELIEF_DEFAULT } from "@/lib/studio/presets";
import { computeStats } from "@/lib/studio/stats";
import { TEXT_LIMITS } from "@/lib/studio/text/fields";
import { configFragment } from "@/lib/studio/url-state";
import { SummitInput, SummitProvider, SummitStage } from "./summit";
import { statsItems, type UnitsTranslator } from "./stats-items";
import styles from "./home.module.css";

// Chapitre 02 « Votre nom, en relief. Littéralement. » (brief « Strates »,
// §7.5), ton « encre » : deux moitiés pleine largeur, le texte et le champ à
// gauche (fond encre du DOM), la vue du sous-verre à droite (un bloc encre dont
// la vue est le fils direct : une fois prête, elle peint elle-même le fond). Le
// chapitre n'est pas un <Chapter> : son en-tête vit dans la moitié encre.
//
// L'étiquette et les chiffres initiaux sont ceux de l'exemple, calculés ici par
// les mêmes fonctions que le Studio ; le client les remplace quand le visiteur
// tape. Le lien du bouton rouge porte la configuration du sous-verre (jamais de
// texte : il arrive au Studio par sessionStorage).
type Locale = "fr" | "de" | "it" | "en";

export function ChapterSummit() {
  const locale = useLocale() as Locale;
  const t = useTranslations("landing.summit");
  const tex = useTranslations("studioCore.examples");
  const tu = useTranslations("studioCore.units");

  const config = RELIEF_DEFAULT;
  const example = tex("peak");
  const initialLabel = peakLabel(example, locale);
  const initialItems = statsItems(
    computeStats(config, { peak: example }, undefined, locale),
    locale,
    tu as UnitsTranslator,
  );
  const href = `/studio/relief${configFragment(config)}`;

  return (
    <section
      id="sommet"
      data-chapter="02"
      aria-labelledby="sommet-title"
      className={`relative scroll-mt-24 ${styles.summit}`}
    >
      <SummitProvider
        config={config}
        example={example}
        initialLabel={initialLabel}
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
          <SummitInput href={href} maxLength={TEXT_LIMITS.peak} />
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
