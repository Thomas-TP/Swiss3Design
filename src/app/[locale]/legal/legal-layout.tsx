import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <span className="flex h-1 w-10 rounded-full bg-accent" />
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-soft">
        Swiss3Design — Gland (VD), {header.country} · {header.updated}{" "}
        {updatedLabel}
      </p>
      {notice && (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-soft">
          {notice}
        </p>
      )}
      <div className="legal-prose mt-10 space-y-8 text-[15px] leading-relaxed text-ink">
        {children}
      </div>
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
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm font-bold tabular-nums text-accent">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-2 pl-9 text-soft">{children}</div>
    </section>
  );
}
