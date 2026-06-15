"use client";

import {
  LayoutDashboard,
  Package,
  Tags,
  Layers,
  ShoppingCart,
  FileText,
  Ticket,
  Users,
  Mail,
  Settings,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const tabs = [
  { href: "/admin", label: "Tableau de bord", Icon: LayoutDashboard },
  { href: "/admin/products", label: "Produits", Icon: Package },
  { href: "/admin/categories", label: "Catégories", Icon: Tags },
  { href: "/admin/materials", label: "Filaments", Icon: Layers },
  { href: "/admin/orders", label: "Commandes", Icon: ShoppingCart },
  { href: "/admin/quotes", label: "Devis", Icon: FileText },
  { href: "/admin/discounts", label: "Codes promo", Icon: Ticket },
  { href: "/admin/customers", label: "Clients", Icon: Users },
  { href: "/admin/emails", label: "E-mails", Icon: Mail },
  { href: "/admin/settings", label: "Réglages", Icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1.5 whitespace-nowrap">
        {tabs.map(({ href, label, Icon }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-ink text-paper"
                    : "border border-line bg-surface text-soft hover:text-ink"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
