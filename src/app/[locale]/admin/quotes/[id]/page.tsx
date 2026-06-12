import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { updateQuote } from "../actions";
import { QUOTE_STATUSES, QUOTE_STATUS_FR, FIELD, BTN_PRIMARY } from "../../ui";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();

  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .limit(1);
  if (!quote) notFound();

  const specs = [
    ["Matière", quote.material],
    ["Couleurs", quote.colors],
    ["Dimensions", quote.dimensions],
  ].filter(([, v]) => v);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/quotes"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft size={15} />
        Tous les devis
      </Link>

      <h2 className="text-xl font-bold">Demande de devis</h2>
      <p className="text-sm text-soft">
        {quote.createdAt.toLocaleString("fr-CH")} ·{" "}
        <a href={`mailto:${quote.email}`} className="underline">
          {quote.email}
        </a>{" "}
        · langue client : {quote.locale.toUpperCase()}
      </p>

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
        <button className={BTN_PRIMARY}>Enregistrer la réponse</button>
        <p className="text-xs leading-relaxed text-soft">
          E-mails automatiques au client : passer en{" "}
          <strong>« Devis envoyé »</strong> avec un prix → e-mail avec la
          proposition · passer en <strong>« Refusée »</strong> → e-mail de
          refus poli (le message ci-dessus sert de motif). Chaque e-mail
          n&apos;est envoyé qu&apos;une seule fois.
        </p>
      </form>
    </div>
  );
}
