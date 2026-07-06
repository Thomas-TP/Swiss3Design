import { For } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { ShoppingBag, CircleUser, Heart } from "lucide-solid";
import { useI18n } from "../i18n/context";
import { useCart } from "../lib/cart";
import { useFavorites } from "../lib/favorites";
import { useSession } from "../lib/auth-client";
import { BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "", key: "home" },
  { href: "/shop", key: "shop" },
  { href: "/custom", key: "custom" },
  { href: "/a-propos", key: "about" },
] as const;

export function Header() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const session = useSession();
  const avatar = () => session().data?.user.image ?? null;

  function isActive(href: string) {
    const rest = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    return href === "" ? rest === "/" : rest.startsWith(href);
  }

  return (
    <header class="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-lg">
      <div class="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <A href={`/${locale()}`} class="flex items-center gap-2.5" aria-label="Swiss3Design">
          <BrandMark class="h-8 w-8 text-ink" />
          <span class="text-[17px] tracking-tight text-ink">
            <span class="font-medium">Swiss</span>
            <span class="font-bold">3Design</span>
          </span>
        </A>

        <nav class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-line/70 bg-surface/60 p-1 backdrop-blur md:flex">
          <For each={LINKS}>
            {(link) => {
              const active = () => isActive(link.href);
              return (
                <A
                  href={`/${locale()}${link.href}`}
                  aria-current={active() ? "page" : undefined}
                  class={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active() ? "bg-paper text-ink shadow-sm ring-1 ring-line" : "text-soft hover:text-ink"
                  }`}
                >
                  {t(`nav.${link.key}`)}
                </A>
              );
            }}
          </For>
        </nav>

        <div class="flex items-center gap-3">
          <ThemeToggle />
          <LocaleSwitcher />
          <A
            href={`/${locale()}/favorites`}
            aria-label={t("nav.favorites")}
            class="relative rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink"
          >
            <Heart size={20} stroke-width={1.8} />
            {favCount() > 0 && (
              <span class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {favCount()}
              </span>
            )}
          </A>
          <A
            href={`/${locale()}/account`}
            aria-label={t("nav.account")}
            class="hidden rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink md:block"
          >
            {avatar() ? (
              <img
                src={avatar() ?? undefined}
                alt=""
                class="h-5 w-5 rounded-full object-cover ring-1 ring-line"
                referrerpolicy="no-referrer"
              />
            ) : (
              <CircleUser size={20} stroke-width={1.8} />
            )}
          </A>
          <A
            href={`/${locale()}/cart`}
            aria-label={t("nav.cart")}
            class="relative hidden rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink md:block"
          >
            <ShoppingBag size={20} stroke-width={1.8} />
            {count() > 0 && (
              <span class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {count()}
              </span>
            )}
          </A>
        </div>
      </div>
    </header>
  );
}
