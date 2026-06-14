import { desc, eq } from "drizzle-orm";
import { FileBox } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { QUOTE_STATUSES, QUOTE_STATUS_FR, STATUS_STYLE } from "../ui";

export default async function AdminQuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ s?: string }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const { s } = await searchParams;
  const statusFilter = (QUOTE_STATUSES as readonly string[]).includes(s ?? "")
    ? (s as (typeof QUOTE_STATUSES)[number])
    : null;

  const db = await getDb();
  const all = await db
    .select({ status: quoteRequests.status })
    .from(quoteRequests);
  const countByStatus = new Map<string, number>();
  for (const row of all) {
    countByStatus.set(row.status, (countByStatus.get(row.status) ?? 0) + 1);
  }

  const rows = await db
    .select()
    .from(quoteRequests)
    .where(statusFilter ? eq(quoteRequests.status, statusFilter) : undefined)
    .orderBy(desc(quoteRequests.createdAt));

  const chips: { value: string | null; label: string; count: number }[] = [
    { value: null, label: "Toutes", count: all.length },
    ...QUOTE_STATUSES.map((st) => ({
      value: st as string,
      label: QUOTE_STATUS_FR[st],
      count: countByStatus.get(st) ?? 0,
    })).filter((c) => c.count > 0),
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={{
              pathname: "/admin/quotes",
              query: c.value ? { s: c.value } : {},
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === c.value
                ? "bg-ink text-paper"
                : "border border-line bg-surface text-soft hover:text-ink"
            }`}
          >
            {c.label}
            <span className="ml-1.5 opacity-60 tabular-nums">{c.count}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          {statusFilter
            ? "Aucune demande avec ce statut."
            : "Aucune demande de devis pour l'instant."}
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
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="line-clamp-1">{q.description}</span>
                    {q.fileUrl && (
                      <FileBox size={13} className="shrink-0 text-soft" />
                    )}
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
