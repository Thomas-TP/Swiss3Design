"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { quoteStatusStyle } from "../_ui";

interface QuoteRow {
  id: string;
  description: string;
  status: string;
  quoted_price: number | null;
}

export default function QuotesTab() {
  const t = useTranslations("account");
  const locale = useLocale();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    medusa.client
      .fetch<{ quotes: QuoteRow[] }>("/store/quotes")
      .then(({ quotes: rows }) => {
        if (!cancelled) setQuotes(rows);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <FileText size={19} className="text-soft" />
        {t("myQuotes")}
      </h1>

      {quotes === null ? null : quotes.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-sm text-soft">{t("noQuotes")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-surface px-5">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link href={`/account/quotes/${q.id}`} className="block py-4 transition-opacity hover:opacity-70">
                <div className="flex items-center justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-medium">{q.description}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${quoteStatusStyle[q.status] ?? "bg-line text-soft"}`}>
                    {t(`quoteStatus.${q.status}`)}
                  </span>
                </div>
                {q.quoted_price != null && (
                  <p className="mt-1 text-xs text-soft">
                    {t("quotedPrice")} : <span className="font-semibold text-ink">{formatChfAmount(q.quoted_price, locale)}</span>
                  </p>
                )}
                {q.status === "quoted" && q.quoted_price != null && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">
                    {t("quoteActionRequired")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
