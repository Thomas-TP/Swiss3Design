import { FileText } from "lucide-react";
import { desc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { statusStyle } from "../_ui";

export const dynamic = "force-dynamic";

export default async function QuotesTab({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getServerSession();
  const { user } = session!;

  const db = await getDb();
  const [myQuotes, t] = await Promise.all([
    db
      .select()
      .from(quoteRequests)
      .where(
        or(
          eq(quoteRequests.customerId, user.id),
          eq(quoteRequests.email, user.email),
        ),
      )
      .orderBy(desc(quoteRequests.createdAt))
      .limit(100),
    getTranslations("account"),
  ]);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <FileText size={19} className="text-soft" />
        {t("myQuotes")}
      </h1>

      {myQuotes.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-6 text-sm text-soft">
          {t("noQuotes")}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-surface px-5">
          {myQuotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/account/quotes/${q.id}`}
                className="block py-4 transition-opacity hover:opacity-70"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-medium">{q.description}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[q.status] ?? "bg-line text-soft"}`}
                  >
                    {t(`quoteStatus.${q.status}`)}
                  </span>
                </div>
                {q.quotedPriceCents != null && (
                  <p className="mt-1 text-xs text-soft">
                    {t("quotedPrice")} :{" "}
                    <span className="font-semibold text-ink">
                      {formatChf(q.quotedPriceCents, locale)}
                    </span>
                  </p>
                )}
                {q.status === "quoted" && q.quotedPriceCents != null && (
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
