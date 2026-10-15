import { useLocale, useTranslations } from "next-intl";
import { Chapter } from "@/components/ui/chapter";
import { MeasureStrip } from "@/components/ui/measure-strip";
import { SiteLink } from "@/components/ui/site-link";
import { formatChf } from "@/lib/format";
import type { StudioObjectId } from "@/lib/studio/types";
import { getHeroPoster } from "./hero-poster";
import { HOME_DATA } from "./home-data.generated";
import type { HomeLocale, ObjectPoster } from "./home-data-types";
import { PosterSvg } from "./poster-svg";
import { statsItems, type UnitsTranslator } from "./stats-items";
import styles from "./home.module.css";

// Chapitre 03 « Réglez-le. On l'imprime. » (brief « Strates », §7.5) : quatre
// cartes d'objet (poster SSR, nom, une ligne, chiffres de la configuration
// d'exemple, prix ferme de la configuration de départ) puis « Comment ça marche » en
// <ol>. Tout est rendu par le serveur : aucun JavaScript, aucune vue WebGL.
// Les chiffres sont ceux de `computeStats` (la fonction du Studio), calculés avec
// les textes d'exemple de chaque langue et figés dans home-data.generated.ts ;
// le prix est le prix ferme d'une pièce (`price.ts`), livraison comprise.
const OBJECTS: StudioObjectId[] = ["lavaux", "cartouche", "montagne", "borne"];
const STEPS = ["set", "send", "check", "print"] as const;

function Poster({ poster }: { poster: ObjectPoster }) {
  if (poster.kind === "hero")
    return <PosterSvg poster={getHeroPoster("final")} />;
  if (poster.kind === "montagne")
    return (
      <>
        <img
          src="/posters/montagne-default-light.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.lightOnly}
        />
        <img
          src="/posters/montagne-default-dark.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.darkOnly}
        />
      </>
    );
  return (
    <span
      className="contents"
      // SVG calculé par le code (topViewToSvg) : aucun texte du visiteur.
      dangerouslySetInnerHTML={{ __html: poster.svg }}
    />
  );
}

export function ChapterStudio() {
  const locale = useLocale() as HomeLocale;
  const t = useTranslations("landing.studio");
  const tc = useTranslations("studioCore");
  const tu = useTranslations("studioCore.units");

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
            const card = HOME_DATA.objects[locale][id];
            const price = t("startPrice", {
              price: formatChf(card.priceCents, locale),
            });
            return (
              <li
                key={id}
                className="s3d-print col-span-full sm:col-span-4 lg:col-span-3"
              >
                <div className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
                  <div className={styles.objectPoster} aria-hidden="true">
                    <Poster poster={card.poster} />
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
                      items={statsItems(
                        card.stats,
                        locale,
                        tu as UnitsTranslator,
                      )}
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
                {t(`steps.${step}.text`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Chapter>
  );
}
