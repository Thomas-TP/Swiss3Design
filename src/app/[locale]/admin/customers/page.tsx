import { desc } from "drizzle-orm";
import { BadgeCheck, ShieldUser } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { orders, user } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

const PAID_STATUSES = new Set(["paid", "in_production", "shipped", "delivered"]);

export default async function AdminCustomersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const db = await getDb();

  const [customers, allOrders] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
    db
      .select({
        customerId: orders.customerId,
        email: orders.email,
        status: orders.status,
        totalCents: orders.totalCents,
      })
      .from(orders),
  ]);

  // Agrégation par client : on rattache une commande par id de compte
  // ou, pour les commandes passées en invité, par adresse e-mail.
  const stats = new Map<string, { count: number; totalCents: number }>();
  const add = (key: string, totalCents: number) => {
    const cur = stats.get(key) ?? { count: 0, totalCents: 0 };
    stats.set(key, { count: cur.count + 1, totalCents: cur.totalCents + totalCents });
  };
  const emailToUserId = new Map(customers.map((c) => [c.email.toLowerCase(), c.id]));
  for (const o of allOrders) {
    if (!PAID_STATUSES.has(o.status)) continue;
    const key = o.customerId ?? emailToUserId.get(o.email.toLowerCase());
    if (key) add(key, o.totalCents);
  }

  return (
    <div>
      <p className="mb-5 text-sm text-soft">
        {customers.length} compte{customers.length > 1 ? "s" : ""} client — le
        total ne compte que les commandes payées.
      </p>

      {customers.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          Aucun compte client pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {customers.map((c) => {
            const s = stats.get(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-line/40 text-sm font-bold text-soft">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    c.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{c.name}</span>
                    {c.role === "admin" && (
                      <ShieldUser size={14} className="shrink-0 text-accent" />
                    )}
                    {c.emailVerified && (
                      <BadgeCheck
                        size={14}
                        className="shrink-0 text-emerald-600"
                      />
                    )}
                  </p>
                  <p className="truncate text-xs text-soft">
                    <a href={`mailto:${c.email}`} className="hover:underline">
                      {c.email}
                    </a>{" "}
                    · inscrit le {c.createdAt.toLocaleDateString("fr-CH")}
                  </p>
                </div>
                {s ? (
                  <Link
                    href={{ pathname: "/admin/orders", query: { q: c.email } }}
                    className="text-right hover:underline"
                  >
                    <p className="text-sm font-semibold tabular-nums">
                      {formatChf(s.totalCents, locale)}
                    </p>
                    <p className="text-xs text-soft">
                      {s.count} commande{s.count > 1 ? "s" : ""}
                    </p>
                  </Link>
                ) : (
                  <span className="text-xs text-soft">Aucune commande</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
