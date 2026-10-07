import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Chapter } from "@/components/ui/chapter";

// Chapitre 05 « Imprimé à Gland et à Pully. Livré partout en Suisse. » (brief
// « Strates », §7.5 ; titre simplifié le 07.10.2026 : « Romanshorn » ne disait
// rien à un lecteur romand) : deux ateliers, leurs machines, leurs coordonnées
// (villes seulement, jamais d'adresse de rue), la livraison offerte dès le
// seuil des réglages (formaté par la page, jamais écrit en dur) et les moyens
// de paiement. C'est aussi l'accès mobile à l'Atelier (lien « Visiter
// l'atelier »). Aucune image : une illustration ChatGPT n'arrive que si le
// propriétaire la fournit, étiquetée « Illustration » (§11.3).
export function ChapterAtelier({ freeOver }: { freeOver: string }) {
  const t = useTranslations("landing.atelier");
  const places = [
    { key: "gland", machine: t("glandMachine"), coords: t("glandCoords") },
    { key: "pully", machine: t("pullyMachine"), coords: t("pullyCoords") },
  ] as const;

  return (
    <Chapter id="atelier" number="05" title={t("title")} eyebrow={t("eyebrow")}>
      <div className="s3d-page s3d-grid mt-12 gap-y-10 lg:mt-16">
        <div className="s3d-rise col-span-full lg:col-span-5">
          <p className="max-w-[48ch] text-lead text-soft">{t("intro")}</p>
          <p className="s3d-label mt-6 normal-case text-ink">
            {t("delivery", { amount: freeOver })}
            <span aria-hidden="true" className="mx-2 text-iso-index">
              ·
            </span>
            {t("payment")}
          </p>
          <ButtonLink href="/a-propos" variant="secondary" className="mt-8">
            {t("visit")}
          </ButtonLink>
        </div>
        <dl className="col-span-full grid gap-6 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
          {places.map((place) => (
            <div key={place.key} className="s3d-rise border-t border-line pt-4">
              <dt className="font-display text-title text-ink">
                {t(place.key)}
              </dt>
              <dd className="mt-3 text-sm text-soft">{place.machine}</dd>
              <dd className="s3d-label mt-2 normal-case text-soft">
                {place.coords}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Chapter>
  );
}
