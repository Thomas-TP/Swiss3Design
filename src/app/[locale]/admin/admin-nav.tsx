"use client";

import {
  LayoutDashboard,
  Package,
  Sparkles,
  Tags,
  Layers,
  ShoppingCart,
  FileText,
  Ticket,
  Users,
  Star,
  Mail,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const groups: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ href: "/admin", label: "Tableau de bord", Icon: LayoutDashboard }],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/products", label: "Produits", Icon: Package },
      { href: "/admin/featured", label: "Sélection du moment", Icon: Sparkles },
      { href: "/admin/categories", label: "Catégories", Icon: Tags },
      { href: "/admin/materials", label: "Filaments & couleurs", Icon: Layers },
    ],
  },
  {
    title: "Ventes",
    items: [
      { href: "/admin/orders", label: "Commandes", Icon: ShoppingCart },
      { href: "/admin/quotes", label: "Devis", Icon: FileText },
      { href: "/admin/discounts", label: "Codes promo", Icon: Ticket },
    ],
  },
  {
    title: "Clients",
    items: [
      { href: "/admin/customers", label: "Clients", Icon: Users },
      { href: "/admin/reviews", label: "Avis", Icon: Star },
    ],
  },
  {
    title: "Système",
    items: [
      { href: "/admin/emails", label: "E-mails", Icon: Mail },
      { href: "/admin/settings", label: "Réglages", Icon: Settings },
    ],
  },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="space-y-5">
      {groups.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wide text-soft/70">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-ink text-paper"
                        : "text-soft hover:bg-line/50 hover:text-ink"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
