import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Paperclip } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests, quoteMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { updateQuote } from "../actions";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_FR,
  STATUS_STYLE,
  FIELD,
  BTN_PRIMARY,
} from "../../ui";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  await requireAdmin();
  const { locale, id } = await params;
  const db = await getDb();

  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .limit(1);
  if (!quote) notFound();

  const messages = await db
    .select()
    .from(quoteMessages)
    .where(eq(quoteMessages.quoteId, id))
    .orderBy(asc(quoteMessages.createdAt));

  const specs = [
    ["Matière", quote.material],
    ["Couleurs", quote.colors],
    ["Dimensions", quote.dimensions],
  ].filter(([, v]) => v);

  // Server component dynamique : l'horloge est stable sur la durée du rendu
  const now = Date.now();
  const quoteExpired = !!quote.validUntil && quote.validUntil.getTime() < now;

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/quotes"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft size={15} />
        Tous les devis
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Demande de devis</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[quote.status] ?? "bg-line text-soft"}`}
        >
          {QUOTE_STATUS_FR[quote.status]}
        </span>
      </div>
      <p className="text-sm text-soft">
        {quote.createdAt.toLocaleString("fr-CH")} ·{" "}
        <a href={`mailto:${quote.email}`} className="underline">
          {quote.email}
        </a>{" "}
        · langue client : {quote.locale.toUpperCase()}
      </p>
      {quote.validUntil && (
        <p className="mt-1 text-xs text-soft">
          Devis valable jusqu&apos;au{" "}
          {quote.validUntil.toLocaleDateString("fr-CH")}
          {quoteExpired && (
            <span className="font-semibold text-accent"> · expiré</span>
          )}
        </p>
      )}

      <section className="mt-5 rounded-card border border-line bg-surface p-5 text-sm">
        <h3 className="mb-2 font-semibold">Description du client</h3>
        <p className="whitespace-pre-wrap leading-relaxed">
          {quote.description}
        </p>
        {specs.length > 0 && (
          <dl className="mt-4 space-y-1 border-t border-line pt-3 text-soft">
            {specs.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {quote.fileUrl && (
          <p className="mt-3 border-t border-line pt-3">
            Fichier 3D :{" "}
            <a
              href={`/api/admin/files/${quote.fileUrl}`}
              className="font-medium underline"
            >
              {quote.fileName ?? "télécharger"} ⬇
            </a>
          </p>
        )}
      </section>

      {messages.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-3 text-sm font-semibold">Fil de discussion</h3>
          <ul className="space-y-3">
            {messages.map((m) => {
              const fromAdmin = m.sender === "admin";
              return (
                <li
                  key={m.id}
                  className={`flex flex-col ${fromAdmin ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      fromAdmin
                        ? "rounded-br-sm bg-ink/5 text-ink"
                        : "rounded-bl-sm border border-orange-500/30 bg-orange-500/5 text-ink"
                    }`}
                  >
                    {m.priceCents != null && (
                      <p className="mb-1 text-base font-bold tabular-nums">
                        {formatChf(m.priceCents, locale)}
                      </p>
                    )}
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    {m.fileName && (
                      <a
                        href={`/api/admin/files/${m.fileUrl}`}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-soft underline"
                      >
                        <Paperclip size={12} className="shrink-0" />
                        {m.fileName}
                      </a>
                    )}
                  </div>
                  <span className="mt-1 px-1 text-[11px] text-soft">
                    {fromAdmin ? "Vous" : "Client"} ·{" "}
                    {m.createdAt.toLocaleDateString("fr-CH", {
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

      <form
        action={updateQuote}
        className="mt-5 space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <h3 className="font-semibold">Réponse</h3>
        <input type="hidden" name="id" value={quote.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Statut</span>
            <select name="status" defaultValue={quote.status} className={FIELD}>
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QUOTE_STATUS_FR[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              Prix proposé (CHF)
            </span>
            <input
              name="price"
              inputMode="decimal"
              defaultValue={
                quote.quotedPriceCents != null
                  ? (quote.quotedPriceCents / 100).toFixed(2)
                  : ""
              }
              placeholder="49.90"
              className={FIELD}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">
            Message pour le client{" "}
            <span className="font-normal text-soft">
              (visible dans son espace et dans l&apos;e-mail)
            </span>
          </span>
          <textarea
            name="adminMessage"
            rows={3}
            defaultValue={quote.adminMessage ?? ""}
            className={FIELD}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">
            Note interne{" "}
            <span className="font-normal text-soft">
              (jamais visible par le client)
            </span>
          </span>
          <textarea
            name="adminNote"
            rows={2}
            defaultValue={quote.adminNote ?? ""}
            placeholder="Ex. : temps d'impression estimé 14 h, prévoir supports solubles…"
            className={FIELD}
          />
        </label>
        <button type="submit" className={BTN_PRIMARY}>Enregistrer la réponse</button>
        <p className="text-xs leading-relaxed text-soft">
          E-mails automatiques au client : passer en{" "}
          <strong>« Devis envoyé »</strong> avec un prix → e-mail avec la
          proposition · passer en <strong>« Refusée »</strong> → e-mail de refus
          poli (le message ci-dessus sert de motif). Chaque e-mail n&apos;est
          envoyé qu&apos;une seule fois.
        </p>
      </form>
    </div>
  );
}
