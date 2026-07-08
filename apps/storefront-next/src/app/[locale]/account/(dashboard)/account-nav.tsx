"use client";

import { LayoutDashboard, Package, User, MapPin, ShieldCheck, Lock, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Devis/Paiement/Notifications sont volontairement absents pour l'instant :
// ces onglets dépendent de concepts D1 custom (pas Medusa, pas better-auth)
// qui nécessitent de nouvelles routes API cross-origine côté app racine
// (Phase 2, pas encore construites).
const tabs: { href: string; key: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/account", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", key: "orders", icon: Package },
  { href: "/account/profile", key: "profile", icon: User },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/security", key: "security", icon: ShieldCheck },
  { href: "/account/privacy", key: "privacy", icon: Lock },
];

export function AccountNav() {
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
    </nav>
  );
}
