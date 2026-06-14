"use client";

import { ShoppingBag, CircleUser, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useSession } from "@/lib/auth-client";
import { BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/shop", key: "shop" },
  { href: "/custom", key: "custom" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const { data: authSession } = useSession();
  const avatar = authSession?.user.image ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Swiss3Design">
          <BrandMark className="h-8 w-8 text-ink" />
          <span className="text-[17px] tracking-tight text-ink">
            <span className="font-medium">Swiss</span>
            <span className="font-bold">3Design</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map(({ href, key }) => (
            <Link
              key={key}
              href={href}
              className={`text-sm font-medium transition-colors hover:text-ink ${
                pathname.startsWith(href) ? "text-ink" : "text-soft"
              }`}
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LocaleSwitcher />
          <Link
            href="/favorites"
            aria-label={t("favorites")}
            className="relative rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink"
          >
            <Heart size={20} strokeWidth={1.8} />
            {favCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            aria-label={t("account")}
            className="hidden rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink md:block"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-5 w-5 rounded-full object-cover ring-1 ring-line"
                referrerPolicy="no-referrer"
              />
            ) : (
              <CircleUser size={20} strokeWidth={1.8} />
            )}
          </Link>
          <Link
            href="/cart"
            aria-label={t("cart")}
            className="relative hidden rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink md:block"
          >
            <ShoppingBag size={20} strokeWidth={1.8} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
