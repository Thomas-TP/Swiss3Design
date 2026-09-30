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
  Bot,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { SiteLink } from "@/components/ui/site-link";

const tabs: { href: string; key: string; icon: LucideIcon; exact?: boolean }[] =
  [
    { href: "/account", key: "overview", icon: LayoutDashboard, exact: true },
    { href: "/account/orders", key: "orders", icon: Package },
    { href: "/account/quotes", key: "quotes", icon: FileText },
    { href: "/account/profile", key: "profile", icon: User },
    { href: "/account/addresses", key: "addresses", icon: MapPin },
    { href: "/account/payment", key: "payment", icon: CreditCard },
    { href: "/account/security", key: "security", icon: ShieldCheck },
    { href: "/account/agents", key: "agents", icon: Bot },
    { href: "/account/notifications", key: "notifications", icon: Bell },
    { href: "/account/privacy", key: "privacy", icon: Lock },
  ];

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("account.nav");
  const tUi = useTranslations("accountUi");
  const pathname = usePathname();

  // L'onglet « Vue d'ensemble » (/account) ne s'allume qu'en correspondance
  // exacte, sinon il resterait actif sur tous les sous-onglets.
  const isActive = (href: string, exact?: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  // L'onglet courant est l'« état courant » : un filet rouge de 2 px (sous
  // l'onglet en rangée mobile, à gauche en colonne), comme le soulignement de
  // la nav du header. Les autres gardent un filet transparent pour que rien ne
  // bouge d'un onglet à l'autre. Pas de transform, pas d'animation.
  const itemClass = (active: boolean) =>
    `flex shrink-0 items-center gap-2.5 rounded-field border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 md:border-b-0 md:border-l-2 ${
      active
        ? "border-accent bg-surface text-ink"
        : "border-transparent text-soft hover:bg-surface hover:text-ink"
    }`;

  return (
    // Mobile : rangée scrollable horizontale. Desktop : colonne.
    <nav
      aria-label={tUi("nav.label")}
      className="-mx-margin flex flex-row gap-1 overflow-x-auto px-margin pb-1 md:mx-0 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
    >
      {tabs.map(({ href, key, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <SiteLink
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          >
            <Icon size={17} strokeWidth={1.5} className="shrink-0" />
            {t(key)}
          </SiteLink>
        );
      })}

      {isAdmin && (
        <SiteLink
          href="/admin"
          className="flex shrink-0 items-center gap-2.5 rounded-field bg-ink px-3.5 py-2.5 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-ink/85 md:mt-2"
        >
          <Wrench size={16} strokeWidth={1.5} className="shrink-0" />
          {t("admin")}
        </SiteLink>
      )}
    </nav>
  );
}
