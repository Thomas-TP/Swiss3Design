"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  noticeStatus,
  setAnalyticsOptOut,
  subscribeAnalyticsOptOut,
} from "@/lib/analytics";
import { buttonClass } from "./ui/button";

// Information sur la mesure d'audience, au régime suisse (art. 45c LTC :
// informer et permettre de refuser) : la mesure tourne déjà, le bandeau ne
// bloque rien. « OK » le referme, « Refuser » coupe toute mesure et tout
// enregistrement. Masqué au paiement (il couvrirait le bouton de commande
// sur mobile) et dans l'admin.
//
// Habillage « Strates » (brief §7.4) : un encart de légende de carte, filet
// sous un titre mono. Mêmes textes, mêmes positions (au-dessus de la
// BottomNav, en bas à gauche dès lg), même logique. « OK » est en encre, pas
// en rouge : le bouton rouge de l'écran reste celui de la page. Ancré pendant
// la « Coupe » (site-consent, page-cut.css) : la page qui s'imprime ne passe
// pas par-dessus.
export function ConsentBanner() {
  const t = useTranslations("consent");
  const pathname = usePathname();
  const status = useSyncExternalStore(
    subscribeAnalyticsOptOut,
    noticeStatus,
    () => "unavailable" as const,
  );
  if (
    status !== "pending" ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/admin")
  )
    return null;

  return (
    <section
      aria-label={t("title")}
      style={{ viewTransitionName: "site-consent" }}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-card border border-line bg-elevated p-4 shadow-lg shadow-ink/10 sm:inset-x-auto sm:left-4 sm:max-w-sm lg:bottom-6 lg:left-6"
    >
      <p className="s3d-label border-b border-line pb-2.5 text-ink">
        {t("title")}
      </p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-soft">
        {t("text")}{" "}
        <Link
          href="/legal/privacy"
          className="text-ink underline decoration-line underline-offset-2 transition-colors hover:decoration-ink"
        >
          {t("learnMore")}
        </Link>
      </p>
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => setAnalyticsOptOut(true)}
          className={buttonClass({
            variant: "secondary",
            size: "sm",
            className: "flex-1",
          })}
        >
          {t("decline")}
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsOptOut(false)}
          className={buttonClass({
            variant: "ink",
            size: "sm",
            className: "flex-1",
          })}
        >
          {t("accept")}
        </button>
      </div>
    </section>
  );
}
