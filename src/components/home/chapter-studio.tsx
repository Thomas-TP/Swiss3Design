import { useLocale, useTranslations } from "next-intl";
import { Chapter } from "@/components/ui/chapter";
import { MeasureStrip } from "@/components/ui/measure-strip";
import { SiteLink } from "@/components/ui/site-link";
import { formatChfRange } from "@/lib/studio/format";
import { PosterSvg } from "./poster-svg";
import { getHeroPoster } from "./hero-poster";
import { statsItems, type UnitsTranslator } from "./stats-items";
import {
  BORNE_DEFAULT,
  CARTOUCHE_DEFAULT,
  DEFAULT_CONFIGS,
} from "@/lib/studio/presets";
import { borneTopView, cartoucheTopView, topViewToSvg } from "@/lib/studio/poster-flat";
import { computeStats } from "@/lib/studio/stats";
import type { StudioObjectId, StudioTexts } from "@/lib/studio/types";
import styles from "./home.module.css";

// Chapitre 03 « Réglez-le. On l'imprime. » (brief « Strates », §7.5) : quatre
// cartes d'objet (poster SSR, nom, une ligne, chiffres de la configuration
// d'exemple, « Sur devis » ou fourchette) puis « Comment ça marche » en
// <ol>. Tout est rendu par le serveur : aucun JavaScript, aucune vue WebGL.
// Les chiffres sortent de `computeStats` (la fonction du Studio) ; un prix n'est
// affiché que si `PRICING.validated` l'a rendu possible (`stats.estimate`).
const OBJECTS: StudioObjectId[] = ["lavaux", "cartouche", "relief", "borne"];
const STEPS = ["set", "send", "check", "print"] as const;

function ObjectPoster({
  id,
  texts,
}: {
  id: StudioObjectId;
  texts: StudioTexts;
}) {
  if (id === "lavaux")
    return <PosterSvg poster={getHeroPoster("final")} />;
  if (id === "relief")
    return (
      <>
        <img
          src="/posters/relief-default-light.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.lightOnly}
        />
        <img
          src="/posters/relief-default-dark.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.darkOnly}
        />
      </>
    );
  const data =
    id === "cartouche"
      ? cartoucheTopView(CARTOUCHE_DEFAULT, texts)
      : borneTopView(BORNE_DEFAULT, texts);
  return (
    <span
      className="contents"
      // SVG calculé par le code (topViewToSvg) : aucun texte du visiteur.
      dangerouslySetInnerHTML={{
        __html: topViewToSvg(data, { className: "h-full w-full" }),
      }}
    />
  );
}

export function ChapterStudio({ freeOver }: { freeOver: string }) {
  const locale = useLocale() as "fr" | "de" | "it" | "en";
  const t = useTranslations("landing.studio");
  const tc = useTranslations("studioCore");
  const tex = useTranslations("studioCore.examples");
  const tu = useTranslations("studioCore.units");

  const texts: StudioTexts = {
    name: tex("name"),
    role: tex("role"),
    line1: tex("line1"),
    line2: tex("line2"),
    peak: tex("peak"),
    text: tex("text"),
  };

  return (
    <Chapter
      id="studio"
      number="03"
      title={t("title")}
      eyebrow={t("eyebrow")}
      intro={t("intro")}
    >
      <div className="s3d-page mt-12 lg:mt-16">
        <ul className="s3d-grid gap-y-4">
          {OBJECTS.map((id) => {
            const stats = computeStats(DEFAULT_CONFIGS[id], texts, undefined, locale);
            const price = stats.estimate
              ? formatChfRange(
                  stats.estimate.lowCents,
                  stats.estimate.highCents,
                  locale,
                )
              : tc("measure.onQuote");
            return (
              <li
                key={id}
                className="s3d-print col-span-full sm:col-span-4 lg:col-span-3"
              >
                <div className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
                  <div className={styles.objectPoster} aria-hidden="true">
                    <ObjectPoster id={id} texts={texts} />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-[1.0625rem] font-bold leading-snug tracking-tight text-ink">
                      <SiteLink
                        href={`/studio/${id}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
                      >
                        {tc(`objects.${id}.name`)}
                      </SiteLink>
                    </h3>
                    <p className="mt-2 flex-1 text-sm text-soft">
                      {tc(`objects.${id}.tagline`)}
                    </p>
                    <MeasureStrip
                      items={statsItems(stats, locale, tu as UnitsTranslator)}
                      className="mt-4 text-soft"
                    />
                    <p className="s3d-label mt-3 flex items-center justify-between normal-case text-ink">
                      <span>{price}</span>
                      <span className="text-soft">{t("adjust")} →</span>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <h3 className="mt-16 font-display text-title text-ink">
          {t("stepsTitle")}
        </h3>
        <ol className="s3d-grid mt-8 gap-y-8">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="s3d-rise col-span-full border-t border-line pt-4 sm:col-span-4 lg:col-span-3"
            >
              <p className="s3d-label text-iso-index">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-2 font-display text-[1.0625rem] font-bold tracking-tight text-ink">
                {t(`steps.${step}.title`)}
              </p>
              <p className="mt-2 text-sm text-soft">
                {t(`steps.${step}.text`, { amount: freeOver })}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Chapter>
  );
}
