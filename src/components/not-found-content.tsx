import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrackEvent } from "@/components/track-event";
import { ButtonLink } from "@/components/ui/button";
import { withDot } from "@/components/ui/dot-title";

// 404 (brief « Strates » §7.18). Un seul contenu, deux appelants :
// - src/app/not-found.tsx : URL sans route (/fr/zzz), rendue entièrement côté
//   serveur par Next (route interne /_not-found) avec un vrai statut 404 ;
// - src/app/[locale]/not-found.tsx : notFound() lancé par une page (produit
//   supprimé), où Next retombe sur un rendu côté client (limite de Fizz, voir
//   src/app/layout.tsx).
// Le contenu s'affiche dans le shell habituel (header, footer) mais hors du
// groupe (site) : ni Lenis ni canvas. C'est l'un des trois moments de champ
// plein écran prévus par la direction (fin du héros, footer, 404) : des
// isolignes SVG statiques, un point rouge « Vous êtes ici », aucun mouvement.
// Le champ est décoratif (aria-hidden) : tout ce qui compte est dans le texte.

// Titre de l'onglet : sans lui, une 404 portait le titre de l'accueil.
export async function notFoundMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");
  return { title: t("notFoundTitle") };
}

export async function NotFoundContent() {
  const [t, ts, tNav] = await Promise.all([
    getTranslations("errors"),
    getTranslations("system.notFound"),
    getTranslations("shell.nav"),
  ]);

  return (
    <div className="s3d-page py-14 md:py-24">
      {/* Liens cassés (internes ou venus d'ailleurs) : URL et provenance
          partent avec l'événement, de quoi corriger ou rediriger. */}
      <TrackEvent event="Page Not Found" />
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0">
          <p className="s3d-label text-soft">{ts("kicker")}</p>
          <h1 className="mt-3 font-display text-display break-words text-ink">
            {withDot(ts("title"))}
          </h1>
          <p className="mt-5 max-w-xl text-lead text-soft">{ts("line")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* Un seul bouton rouge : le retour à l'accueil. */}
            <ButtonLink href="/" variant="primary" size="lg">
              {t("notFoundCta")}
              <ArrowRight size={18} strokeWidth={1.5} />
            </ButtonLink>
            <ButtonLink href="/studio" variant="secondary" size="lg">
              {tNav("studio")}
            </ButtonLink>
            <ButtonLink href="/shop" variant="text" size="lg">
              {tNav("shop")}
            </ButtonLink>
          </div>
        </div>

        {/* Isolignes statiques, une image par thème (seule celle du thème
            courant est chargée : c'est un fond CSS). Le point rouge est le
            seul élément rouge du champ (la buse, l'état courant). */}
        <div
          aria-hidden="true"
          className="relative aspect-[5/3] w-full overflow-hidden rounded-card border border-line bg-surface bg-cover bg-center bg-[url('/posters/field-404-light.svg')] dark:bg-[url('/posters/field-404-dark.svg')]"
        >
          <span className="absolute left-[58%] top-[46%] block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-4 ring-accent/25" />
          <span className="s3d-label absolute left-[58%] top-[46%] ml-4 -translate-y-1/2 whitespace-nowrap rounded-hair bg-paper/85 px-1.5 py-0.5 text-ink">
            {ts("here")}
          </span>
        </div>
      </div>
    </div>
  );
}
