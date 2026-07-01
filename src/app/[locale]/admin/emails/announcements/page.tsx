import { desc, eq } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/db";
import { products, productTranslations, newsletterSends } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ComposeForm } from "./compose-form";

const AUDIENCE_LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  product_news: "Nouveautés produits",
  both: "Les deux",
};

export default async function AnnouncementsPage() {
  await requireAdmin();
  const db = await getDb();

  const productRows = await db
    .select({
      id: products.id,
      name: productTranslations.name,
      priceCents: products.priceCents,
    })
    .from(products)
    .innerJoin(
      productTranslations,
      eq(productTranslations.productId, products.id),
    )
    .where(eq(products.active, true))
    .orderBy(products.slug);

  const history = await db
    .select()
    .from(newsletterSends)
    .orderBy(desc(newsletterSends.createdAt))
    .limit(20);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex gap-1.5 border-b border-line pb-3">
        <Link
          href="/admin/emails"
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-soft hover:text-ink"
        >
          Aperçu
        </Link>
        <span className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-paper">
          Annonces
        </span>
      </div>

      <h2 className="text-xl font-bold">Annonces newsletter</h2>
      <p className="mb-6 text-sm text-soft">
        Composez une annonce et envoyez-la aux clients inscrits (préférences
        gérées par chaque client dans son compte).
      </p>

      <ComposeForm
        products={productRows.map((p) => ({
          id: p.id,
          label: `${p.name} — ${formatChf(p.priceCents, "fr")}`,
        }))}
      />

      {history.length > 0 && (
        <div className="mt-10 border-t border-line pt-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-soft">
            Historique
          </h3>
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{h.subject}</p>
                  <p className="text-xs text-soft">
                    {AUDIENCE_LABELS[h.audience] ?? h.audience} · {h.recipientCount}{" "}
                    destinataires · {new Date(h.createdAt).toLocaleDateString("fr-CH")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
