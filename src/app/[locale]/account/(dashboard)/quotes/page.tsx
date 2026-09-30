import { FileText } from "lucide-react";
import { desc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { AccountTitle } from "../account-title";
import { badge, card, rowLinkBlock, rowList, statusBadge } from "../_ui";

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
      <AccountTitle title={t("myQuotes")} icon={FileText} />

      {myQuotes.length === 0 ? (
        <p className={`${card} text-sm text-soft`}>{t("noQuotes")}</p>
      ) : (
        <ul className={rowList}>
          {myQuotes.map((q) => (
            <li key={q.id}>
              <Link href={`/account/quotes/${q.id}`} className={rowLinkBlock}>
                <div className="flex items-center justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-medium">
                    {q.description}
                  </p>
                  <span className={statusBadge(q.status)}>
                    {t(`quoteStatus.${q.status}`)}
                  </span>
                </div>
                {q.quotedPriceCents != null && (
                  <p className="mt-1 text-xs text-soft">
                    {t("quotedPrice")} :{" "}
                    <span className="s3d-num font-semibold text-ink">
                      {formatChf(q.quotedPriceCents, locale)}
                    </span>
                  </p>
                )}
                {q.status === "quoted" && q.quotedPriceCents != null && (
                  // Plusieurs devis peuvent attendre une réponse : en encre, le
                  // rouge reste à l'action principale d'un écran.
                  <span className={`${badge} mt-2 bg-ink text-paper`}>
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
