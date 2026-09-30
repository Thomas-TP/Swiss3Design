import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import styles from "./legal-layout.module.css";

// Mise en page « Strates » des pages légales (brief §7.22) : typographie
// seulement (legal-layout.module.css), jamais le texte des documents.
//
// Dernière mise à jour de chaque document : affichée en tête de page ET
// reprise comme <lastmod> du sitemap (une seule source, jamais désynchronisées).
export const LEGAL_UPDATED = {
  terms: "2026-09-27",
  privacy: "2026-09-27",
  shipping: "2026-07-10",
} as const;

export interface LegalSection {
  title: string;
  body: ReactNode;
}

// Les traductions sont fournies à titre de courtoisie : seule la version
// française engage l'exploitant.
const NOTICE: Record<string, string | null> = {
  fr: null,
  de: "Massgebend ist die französische Fassung dieses Dokuments.",
  it: "Fa fede la versione francese di questo documento.",
  en: "The French version of this document prevails.",
};

const HEADER: Record<string, { country: string; updated: string }> = {
  fr: { country: "Suisse", updated: "Dernière mise à jour :" },
  de: { country: "Schweiz", updated: "Letzte Aktualisierung:" },
  it: { country: "Svizzera", updated: "Ultimo aggiornamento:" },
  en: { country: "Switzerland", updated: "Last updated:" },
};

export function LegalPage({
  locale,
  title,
  updated, // date ISO (ex. "2026-06-11"), formatée dans la langue de la page
  children,
}: {
  locale: Locale;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const notice = NOTICE[locale];
  const header = HEADER[locale] ?? HEADER.fr;
  const updatedLabel = new Intl.DateTimeFormat(`${locale}-CH`, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(updated));

  // Le <main> est celui du layout racine de [locale] : un seul par page.
  return (
    <div className={styles.page}>
      <h1 className="break-words font-display text-title text-ink">{title}</h1>
      <p className="mt-3 text-sm text-soft">
        Swiss3Design — Gland (VD), {header.country} · {header.updated}{" "}
        <time dateTime={updated}>{updatedLabel}</time>
      </p>
      {notice && <p className={styles.notice}>{notice}</p>}
      <div className={styles.prose}>{children}</div>
    </div>
  );
}

export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  const t = useTranslations("accountUi");
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        <span className={styles.art}>
          {t("legal.article")} {n}
        </span>
        <span className="min-w-0 break-words">{title}</span>
      </h2>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
