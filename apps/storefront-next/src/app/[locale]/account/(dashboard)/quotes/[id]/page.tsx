"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, FileBox, Paperclip, Pencil, Ban } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { medusa } from "@/lib/medusa";
import { formatChfAmount } from "@/lib/format";
import { quoteStatusStyle } from "../../_ui";
import { QuoteActions } from "./quote-actions";

interface QuoteMessage {
  id: string;
  sender: "customer" | "admin";
  body: string;
  price: number | null;
  file_name: string | null;
  created_at: string;
}

interface QuoteDetail {
  id: string;
  description: string;
  material: string | null;
  colors: string | null;
  dimensions: string | null;
  file_name: string | null;
  status: string;
  quoted_price: number | null;
  admin_message: string | null;
  valid_until: string | null;
  created_at: string;
  messages: QuoteMessage[];
}

function StateNote({ tone, text, icon }: { tone: "info" | "success" | "muted"; text: string; icon?: React.ReactNode }) {
  const styles = {
    info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    muted: "border-line bg-surface text-soft",
  }[tone];
  return (
    <p className={`mt-5 flex items-center gap-2 rounded-card border px-5 py-4 text-sm font-medium ${styles}`}>
      {icon}
      {text}
    </p>
  );
}

export default function QuoteDetailPage() {
  const t = useTranslations("account");
  const td = useTranslations("account.quoteDetail");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteDetail | null | undefined>(undefined);

  const load = useCallback(() => {
    medusa.client
      .fetch<{ quote: QuoteDetail }>(`/store/quotes/${params.id}`)
      .then(({ quote: q }) => setQuote(q))
      .catch(() => setQuote(null));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (quote === undefined) return null;
  if (quote === null) {
    return (
      <div className="max-w-xl">
        <Link href="/account/quotes" className="inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink">
          <ArrowLeft size={15} />
          {t("orderDetail.back")}
        </Link>
      </div>
    );
  }

  const dateFmt = (d: string) => new Date(d).toLocaleDateString(`${locale}-CH`, { day: "numeric", month: "long", year: "numeric" });

  const specs = [
    [td("specMaterial"), quote.material],
    [td("specColors"), quote.colors],
    [td("specDimensions"), quote.dimensions],
  ].filter(([, v]) => v) as [string, string][];

  // eslint-disable-next-line react-hooks/purity -- l'horloge est stable sur la durée du rendu
  const now = Date.now();
  const hasQuote = quote.quoted_price != null && quote.quoted_price > 0;
  const expired = !!quote.valid_until && new Date(quote.valid_until).getTime() < now && (quote.status === "quoted" || quote.status === "accepted");
  const decisionPending = quote.status === "quoted" || quote.status === "accepted";
  const canPay = hasQuote && decisionPending && !expired;
  const showActions = decisionPending || quote.status === "revision_requested";

  return (
    <div className="max-w-xl">
      <Link href="/account/quotes" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink">
        <ArrowLeft size={15} />
        {t("orderDetail.back")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{td("title")}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quoteStatusStyle[quote.status] ?? "bg-line text-soft"}`}>
          {t(`quoteStatus.${quote.status}`)}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-soft">{td("submittedOn", { date: dateFmt(quote.created_at) })}</p>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold">{td("requestTitle")}</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-soft">{quote.description}</p>
        {specs.length > 0 && (
          <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-soft">
            {specs.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-ink">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {quote.file_name && (
          <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-sm text-soft">
            <FileBox size={14} className="shrink-0" />
            {quote.file_name}
          </p>
        )}
      </section>

      {hasQuote && (
        <section className="mt-5 rounded-card border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm font-medium text-soft">{t("quotedPrice")}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{formatChfAmount(quote.quoted_price!, locale)}</p>
          {quote.valid_until && (
            <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${expired ? "text-accent" : "text-soft"}`}>
              <Clock size={13} />
              {expired ? td("expired") : td("validUntil", { date: dateFmt(quote.valid_until) })}
            </p>
          )}
          {quote.admin_message && (
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-soft ring-1 ring-line">{quote.admin_message}</p>
          )}

          {showActions && <QuoteActions quoteId={quote.id} canPay={canPay} canRevise={decisionPending} canDecline={showActions} onChanged={load} />}
        </section>
      )}

      {quote.status === "received" && <StateNote tone="info" text={td("receivedNote")} />}
      {quote.status === "revision_requested" && <StateNote tone="info" icon={<Pencil size={15} />} text={td("revisionPendingNote")} />}
      {(quote.status === "paid" || quote.status === "in_production" || quote.status === "done") && (
        <StateNote tone="success" icon={<CheckCircle2 size={15} />} text={td("paidNote")} />
      )}
      {quote.status === "declined" && (
        <div className="mt-5 rounded-card border border-line bg-surface p-5 text-center">
          <Ban size={22} className="mx-auto text-soft" strokeWidth={1.8} />
          <p className="mt-3 text-sm text-soft">{td("declinedNote")}</p>
          <Link href="/custom" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90">
            {td("newRequest")}
          </Link>
        </div>
      )}
      {quote.status === "rejected" && <StateNote tone="muted" text={td("rejectedNote")} />}

      {quote.messages.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">{td("threadTitle")}</h2>
          <ul className="space-y-3">
            {quote.messages.map((m) => {
              const mine = m.sender === "customer";
              return (
                <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      mine ? "rounded-br-sm bg-accent/10 text-ink" : "rounded-bl-sm border border-line bg-surface text-ink"
                    }`}
                  >
                    {m.price != null && <p className="mb-1 text-base font-bold tabular-nums">{formatChfAmount(m.price, locale)}</p>}
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    {m.file_name && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-soft">
                        <Paperclip size={12} className="shrink-0" />
                        {m.file_name}
                      </p>
                    )}
                  </div>
                  <span className="mt-1 px-1 text-[11px] text-soft">
                    {mine ? td("you") : td("studio")} · {new Date(m.created_at).toLocaleDateString(`${locale}-CH`, { day: "numeric", month: "short" })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
