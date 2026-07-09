import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileBox,
  Paperclip,
  Pencil,
  Ban,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests, quoteMessages } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { QuoteActions } from "./quote-actions";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  received: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  revision_requested: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  declined: "bg-red-500/15 text-red-600 dark:text-red-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  in_production: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-stone-500/15 text-stone-600 dark:text-stone-300",
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect({ href: "/account/login", locale });
  }
  const { user } = session!;

  const db = await getDb();
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(
      and(
        eq(quoteRequests.id, id),
        or(
          eq(quoteRequests.customerId, user.id),
          eq(quoteRequests.email, user.email),
        ),
      ),
    )
    .limit(1);
  if (!quote) notFound();

  const messages = await db
    .select()
    .from(quoteMessages)
    .where(eq(quoteMessages.quoteId, quote.id))
    .orderBy(asc(quoteMessages.createdAt));

  const t = await getTranslations("account");
  const td = await getTranslations("account.quoteDetail");

  const dateFmt = (d: Date) =>
    d.toLocaleDateString(`${locale}-CH`, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const specs = [
    [td("specMaterial"), quote.material],
    [td("specColors"), quote.colors],
    [td("specDimensions"), quote.dimensions],
  ].filter(([, v]) => v) as [string, string][];

  // Server component dynamique : l'horloge est stable sur la durée du rendu
  const now = Date.now();
  const hasQuote = quote.quotedPriceCents != null && quote.quotedPriceCents > 0;
  const expired =
    !!quote.validUntil &&
    quote.validUntil.getTime() < now &&
    (quote.status === "quoted" || quote.status === "accepted");
  const decisionPending =
    quote.status === "quoted" || quote.status === "accepted";
  const canPay = hasQuote && decisionPending && !expired;
  const showActions = decisionPending || quote.status === "revision_requested";

  return (
    <div className="max-w-xl">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("orderDetail.back")}
      </Link>

      {/* En-tête : titre + statut + date */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{td("title")}</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[quote.status] ?? "bg-line text-soft"}`}
        >
          {t(`quoteStatus.${quote.status}`)}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-soft">
        {td("submittedOn", { date: dateFmt(quote.createdAt) })}
      </p>

      {/* Récap de la demande */}
      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold">{td("requestTitle")}</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-soft">
          {quote.description}
        </p>
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
        {quote.fileName && (
          <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-sm text-soft">
            <FileBox size={14} className="shrink-0" />
            {quote.fileName}
          </p>
        )}
      </section>

      {/* Le devis chiffré */}
      {hasQuote && (
        <section className="mt-5 rounded-card border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm font-medium text-soft">{t("quotedPrice")}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
            {formatChf(quote.quotedPriceCents!, locale)}
          </p>
          {quote.validUntil && (
            <p
              className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${expired ? "text-accent" : "text-soft"}`}
            >
              <Clock size={13} />
              {expired
                ? td("expired")
                : td("validUntil", { date: dateFmt(quote.validUntil) })}
            </p>
          )}
          {quote.adminMessage && (
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-soft ring-1 ring-line">
              {quote.adminMessage}
            </p>
          )}

          {showActions && (
            <QuoteActions
              quoteId={quote.id}
              canPay={canPay}
              canRevise={decisionPending}
              canDecline={showActions}
            />
          )}
        </section>
      )}

      {/* Notes d'état */}
      {quote.status === "received" && (
        <StateNote tone="info" text={td("receivedNote")} />
      )}
      {quote.status === "revision_requested" && (
        <StateNote
          tone="info"
          icon={<Pencil size={15} />}
          text={td("revisionPendingNote")}
        />
      )}
      {(quote.status === "paid" ||
        quote.status === "in_production" ||
        quote.status === "done") && (
        <StateNote
          tone="success"
          icon={<CheckCircle2 size={15} />}
          text={td("paidNote")}
        />
      )}
      {quote.status === "declined" && (
        <div className="mt-5 rounded-card border border-line bg-surface p-5 text-center">
          <Ban size={22} className="mx-auto text-soft" strokeWidth={1.8} />
          <p className="mt-3 text-sm text-soft">{td("declinedNote")}</p>
          <Link
            href="/custom"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            {td("newRequest")}
          </Link>
        </div>
      )}
      {quote.status === "rejected" && (
        <StateNote tone="muted" text={td("rejectedNote")} />
      )}

      {/* Fil de discussion */}
      {messages.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">{td("threadTitle")}</h2>
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.sender === "customer";
              return (
                <li
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      mine
                        ? "rounded-br-sm bg-accent/10 text-ink"
                        : "rounded-bl-sm border border-line bg-surface text-ink"
                    }`}
                  >
                    {m.priceCents != null && (
                      <p className="mb-1 text-base font-bold tabular-nums">
                        {formatChf(m.priceCents, locale)}
                      </p>
                    )}
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    {m.fileName && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-soft">
                        <Paperclip size={12} className="shrink-0" />
                        {m.fileName}
                      </p>
                    )}
                  </div>
                  <span className="mt-1 px-1 text-[11px] text-soft">
                    {mine ? td("you") : td("studio")} ·{" "}
                    {m.createdAt.toLocaleDateString(`${locale}-CH`, {
                      day: "numeric",
                      month: "short",
                    })}
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

function StateNote({
  tone,
  text,
  icon,
}: {
  tone: "info" | "success" | "muted";
  text: string;
  icon?: React.ReactNode;
}) {
  const styles = {
    info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
    success:
      "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    muted: "border-line bg-surface text-soft",
  }[tone];
  return (
    <p
      className={`mt-5 flex items-center gap-2 rounded-card border px-5 py-4 text-sm font-medium ${styles}`}
    >
      {icon}
      {text}
    </p>
  );
}
