import { Package, FileText, Wrench } from "lucide-react";
import { desc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { SignOutButton } from "./sign-out-button";
import { AvatarPicker } from "./avatar-picker";
import { AccountSecurity } from "./account-security";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  in_production: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-300",
  received: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-300",
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect({ href: "/account/login", locale });
  }
  const { user } = session!;

  const db = await getDb();
  const [myOrders, myQuotes, t] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(or(eq(orders.customerId, user.id), eq(orders.email, user.email)))
      .orderBy(desc(orders.createdAt))
      .limit(20),
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
      .limit(20),
    getTranslations("account"),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AvatarPicker current={user.image ?? null} />
          <div>
            <h1 className="text-xl font-bold">
              {t("greeting", { name: user.name })}
            </h1>
            <p className="text-sm text-soft">{user.email}</p>
          </div>
        </div>
        <SignOutButton />
      </div>

      {user.role === "admin" && (
        <Link
          href="/admin"
          className="mt-6 flex items-center gap-2.5 rounded-card border border-ink bg-ink px-5 py-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
        >
          <Wrench size={17} />
          Administration de la boutique
        </Link>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-semibold">
          <Package size={17} className="text-soft" />
          {t("myOrders")}
        </h2>
        {myOrders.length === 0 ? (
          <p className="mt-3 rounded-card border border-line bg-surface p-6 text-sm text-soft">
            {t("noOrders")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
            {myOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 py-4 transition-opacity hover:opacity-70"
                >
                  <div>
                    <p className="text-sm font-semibold">{o.orderNumber}</p>
                    <p className="text-xs text-soft">
                      {o.createdAt.toLocaleDateString(`${locale}-CH`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[o.status] ?? "bg-line text-soft"}`}
                    >
                      {t(`status.${o.status}`)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatChf(o.totalCents, locale)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileText size={17} className="text-soft" />
          {t("myQuotes")}
        </h2>
        {myQuotes.length === 0 ? (
          <p className="mt-3 rounded-card border border-line bg-surface p-6 text-sm text-soft">
            {t("noQuotes")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5">
            {myQuotes.map((q) => (
              <li key={q.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-medium">
                    {q.description}
                  </p>
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
                    {q.adminMessage && <> — {q.adminMessage}</>}
                  </p>
                )}
                {q.status === "quoted" && q.quotedPriceCents != null && (
                  <Link
                    href={`/account/quotes/${q.id}/pay`}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
                  >
                    {t("quotePay.cta")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AccountSecurity />
    </div>
  );
}
