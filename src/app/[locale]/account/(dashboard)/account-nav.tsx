"use client";

import {
  LayoutDashboard,
  Package,
  FileText,
  User,
  MapPin,
  CreditCard,
  Bell,
  ShieldCheck,
  Lock,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const tabs: { href: string; key: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/account", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", key: "orders", icon: Package },
  { href: "/account/quotes", key: "quotes", icon: FileText },
  { href: "/account/profile", key: "profile", icon: User },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/payment", key: "payment", icon: CreditCard },
  { href: "/account/security", key: "security", icon: ShieldCheck },
  { href: "/account/notifications", key: "notifications", icon: Bell },
  { href: "/account/privacy", key: "privacy", icon: Lock },
];

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("account.nav");
  const pathname = usePathname();

  // L'onglet « Vue d'ensemble » (/account) ne s'allume qu'en correspondance
  // exacte, sinon il resterait actif sur tous les sous-onglets.
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const itemClass = (active: boolean) =>
    `flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-ink text-paper" : "text-soft hover:bg-surface hover:text-ink"
    }`;

  return (
    // Mobile : rangée scrollable horizontale. Desktop : colonne sticky.
    <nav className="-mx-4 flex flex-row gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
      {tabs.map(({ href, key, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link key={key} href={href} className={itemClass(active)}>
            <Icon size={17} className="shrink-0" />
            {t(key)}
          </Link>
        );
      })}

      {isAdmin && (
        <Link
          href="/admin"
          className="flex shrink-0 items-center gap-2.5 rounded-xl border border-ink bg-ink px-3.5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 md:mt-2"
        >
          <Wrench size={16} className="shrink-0" />
          {t("admin")}
        </Link>
      )}
    </nav>
  );
}
