"use client";

import {
  Home,
  LayoutGrid,
  Sparkles,
  ShoppingBag,
  CircleUser,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/auth-client";

const items = [
  { href: "/", key: "home", Icon: Home },
  { href: "/shop", key: "shop", Icon: LayoutGrid },
  { href: "/custom", key: "custom", Icon: Sparkles },
  { href: "/cart", key: "cart", Icon: ShoppingBag },
  { href: "/account", key: "account", Icon: CircleUser },
] as const;

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { count } = useCart();
  const { data: authSession } = useSession();
  const avatar = authSession?.user.image ?? null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/90 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, key, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
              >
                <span className="relative">
                  {key === "account" && avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`h-[22px] w-[22px] rounded-full object-cover ${
                        active ? "ring-2 ring-ink" : "ring-1 ring-line"
                      }`}
                    />
                  ) : (
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.4 : 1.8}
                      className={active ? "text-ink" : "text-soft"}
                    />
                  )}
                  {key === "cart" && count > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </span>
                <span
                  className={`whitespace-nowrap text-[10px] leading-tight ${
                    active ? "text-ink" : "text-soft"
                  }`}
                >
                  {t(key)}
                </span>
                {active && (
                  <span className="absolute -top-px h-0.5 w-8 rounded-full bg-accent" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
