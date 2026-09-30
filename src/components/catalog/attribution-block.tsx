import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { licenseDeedUrl, type Attribution } from "@/lib/attribution";
import { SpecTable } from "@/components/ui/spec-table";

// Crédit de design d'un modèle que l'atelier imprime TEL QUEL (brief
// « Strates », §1.5 point 2 et §7.9, chapitre « Crédit du design »). Obligation
// de la licence Creative Commons BY-ND 4.0 de Ian (Vase spirale) : nom, licence,
// lien vers le modèle et vers le deed, dans la langue de la page, rendus CÔTÉ
// SERVEUR (un moteur, un agent ou un lecteur d'écran les lit sans JavaScript).
// Jamais de formulation qui laisse croire à un partenariat : la phrase dit
// « sans aucune modification » et « n'implique aucune approbation ».
//
// Les liens sortent du site : `noopener noreferrer`, dans un nouvel onglet,
// avec le nom de la cible dans le texte du lien (pas de « cliquez ici »).

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-iso-index decoration-1 underline-offset-4 hover:decoration-ink"
    >
      {children}
    </a>
  );
}

export function AttributionBlock({
  attribution,
  locale,
  className,
}: {
  attribution: Attribution;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations("catalog.attribution");
  const deed = licenseDeedUrl(attribution, locale);

  return (
    <div className={className}>
      <p className="max-w-[65ch] text-lead text-ink">
        {t.rich("body", {
          author: attribution.author,
          title: attribution.title,
          platform: attribution.platform,
          strong: (chunks) => (
            <strong className="font-semibold">{chunks}</strong>
          ),
          model: (chunks) => (
            <ExternalLink href={attribution.url}>{chunks}</ExternalLink>
          ),
          deed: (chunks) => <ExternalLink href={deed}>{chunks}</ExternalLink>,
        })}
      </p>
      <SpecTable
        className="mt-8 max-w-[40rem]"
        rows={[
          { term: t("dl.author"), value: attribution.author },
          {
            term: t("dl.model"),
            value: t.rich("dl.modelValue", {
              title: attribution.title,
              platform: attribution.platform,
              link: (chunks) => (
                <ExternalLink href={attribution.url}>{chunks}</ExternalLink>
              ),
            }),
          },
          {
            term: t("dl.license"),
            value: (
              <ExternalLink href={deed}>{attribution.license}</ExternalLink>
            ),
          },
          // Affirmé seulement tant que c'est vrai (le test de attribution.ts
          // garde `modified: false`) : jamais une « Aucune » qui mentirait.
          ...(attribution.modified
            ? []
            : [{ term: t("dl.modifications"), value: t("dl.none") }]),
        ]}
      />
    </div>
  );
}
