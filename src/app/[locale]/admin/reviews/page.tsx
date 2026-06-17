import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { reviews, productTranslations } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { StarRating } from "@/components/star-rating";
import { setReviewStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_FR: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  rejected: "Rejeté",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-300",
};

const ACTION_BTN =
  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors";

export default async function AdminReviewsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({
      id: reviews.id,
      productName: productTranslations.name,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, reviews.productId),
        eq(productTranslations.locale, "fr"),
      ),
    )
    // Les avis en attente d'abord, puis les plus récents.
    .orderBy(
      sql`case ${reviews.status} when 'pending' then 0 else 1 end`,
      desc(reviews.createdAt),
    );

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">Avis</h2>
      <p className="mb-5 text-sm text-soft">
        {rows.length} avis · {pending} en attente de modération
      </p>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">Aucun avis pour l’instant.</p>
          <p className="mt-1 text-sm">
            Les clients peuvent noter un produit après livraison de leur commande.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-card border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StarRating value={r.rating} size={14} />
                  <span className="text-sm font-semibold">
                    {r.productName ?? "Produit supprimé"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[r.status]}`}
                  >
                    {STATUS_FR[r.status]}
                  </span>
                </div>
                <span className="text-xs text-soft">
                  {r.authorName} · {r.createdAt.toLocaleDateString("fr-CH")}
                </span>
              </div>
              {r.body && (
                <p className="mt-2 text-sm leading-relaxed text-soft">{r.body}</p>
              )}
              <div className="mt-3 flex gap-2">
                {r.status !== "published" && (
                  <form action={setReviewStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="published" />
                    <button
                      className={`${ACTION_BTN} bg-emerald-600 text-white hover:opacity-90`}
                    >
                      Publier
                    </button>
                  </form>
                )}
                {r.status !== "rejected" && (
                  <form action={setReviewStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button
                      className={`${ACTION_BTN} border border-line text-soft hover:border-ink hover:text-ink`}
                    >
                      Rejeter
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
