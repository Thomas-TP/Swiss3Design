import { desc } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { QUOTE_STATUS_FR, STATUS_STYLE } from "../ui";

export default async function AdminQuotesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const db = await getDb();
  const rows = await db
    .select()
    .from(quoteRequests)
    .orderBy(desc(quoteRequests.createdAt));

  return (
    <div>
      <p className="mb-5 text-sm text-soft">
        {rows.length} demande{rows.length > 1 ? "s" : ""} de devis
      </p>
      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          Aucune demande de devis pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {rows.map((q) => (
            <li key={q.id} className="py-3.5">
              <Link
                href={`/admin/quotes/${q.id}`}
                className="flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">
                    {q.description}
                  </p>
                  <p className="text-xs text-soft">
                    {q.createdAt.toLocaleDateString("fr-CH")} · {q.email} ·
                    langue : {q.locale.toUpperCase()}
                  </p>
                </div>
                {q.quotedPriceCents != null && (
                  <span className="text-sm font-semibold tabular-nums">
                    {formatChf(q.quotedPriceCents, locale)}
                  </span>
                )}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[q.status]}`}
                >
                  {QUOTE_STATUS_FR[q.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
