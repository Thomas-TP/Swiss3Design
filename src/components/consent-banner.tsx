"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  noticeStatus,
  setAnalyticsOptOut,
  subscribeAnalyticsOptOut,
} from "@/lib/analytics";

// Information sur la mesure d'audience, au régime suisse (art. 45c LTC :
// informer et permettre de refuser) : la mesure tourne déjà, le bandeau ne
// bloque rien. « OK » le referme, « Refuser » coupe toute mesure et tout
// enregistrement. Masqué au paiement (il couvrirait le bouton de commande
// sur mobile) et dans l'admin.
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
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-card border border-line bg-surface p-4 shadow-xl shadow-ink/10 sm:inset-x-auto sm:left-4 sm:max-w-sm lg:bottom-6 lg:left-6"
    >
      <p className="text-sm font-semibold">{t("title")}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
        {t("text")}{" "}
        <Link
          href="/legal/privacy"
          className="underline transition-colors hover:text-ink"
        >
          {t("learnMore")}
        </Link>
      </p>
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => setAnalyticsOptOut(true)}
          className="flex-1 rounded-full border border-line px-4 py-2 text-sm font-semibold transition-colors hover:border-ink"
        >
          {t("decline")}
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsOptOut(false)}
          className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
        >
          {t("accept")}
        </button>
      </div>
    </section>
  );
}
