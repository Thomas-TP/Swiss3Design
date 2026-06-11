import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";

const NOTICE: Record<string, string | null> = {
  fr: null,
  de: "Massgebend ist die französische Fassung dieses Dokuments.",
  it: "Fa fede la versione francese di questo documento.",
  en: "The French version of this document prevails.",
};

export function LegalPage({
  locale,
  title,
  updated,
  children,
}: {
  locale: Locale;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const notice = NOTICE[locale];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-soft">
        Swiss3Design — Gland (VD), Suisse · Dernière mise à jour : {updated}
      </p>
      {notice && (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-soft">
          {notice}
        </p>
      )}
      <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-ink">
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
      <h2 className="mb-2 text-lg font-bold">
        {n}. {title}
      </h2>
      <div className="space-y-2 text-soft">{children}</div>
    </section>
  );
}
