"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { useHomeConfig } from "./home-config-context";
import { studioHref } from "./hero-data";

// Les trois entrées de l'accueil (brief « Strates », §1.4, §5.1) : Régler
// (Studio), Acheter (boutique), J'ai un fichier (sur mesure). Le bouton rouge,
// le seul de l'écran, suit la configuration réglée dans le héros : on
// continue au Studio exactement ce qu'on vient de régler (`#c=v1.…`, jamais de
// texte personnel dans l'URL).
export function HeroCtas() {
  const t = useTranslations("landing.hero");
  const { config } = useHomeConfig();
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
      <ButtonLink
        href={studioHref(config)}
        variant="primary"
        size="lg"
        className="w-full sm:w-auto"
      >
        {t("ctaStudio")}
      </ButtonLink>
      <ButtonLink
        href="/shop"
        variant="secondary"
        size="lg"
        className="w-full sm:w-auto"
      >
        {t("ctaShop")}
      </ButtonLink>
      <ButtonLink href="/custom" variant="text" size="md">
        {t("ctaFile")}
      </ButtonLink>
    </div>
  );
}
