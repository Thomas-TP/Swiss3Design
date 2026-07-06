import { For } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { Home, LayoutGrid, Sparkles, ShoppingBag, CircleUser } from "lucide-solid";
import { useI18n } from "../i18n/context";
import { useCart } from "../lib/cart";
import { useSession } from "../lib/auth-client";

const ITEMS = [
  { href: "", key: "home", Icon: Home },
  { href: "/shop", key: "shop", Icon: LayoutGrid },
  { href: "/custom", key: "custom", Icon: Sparkles },
  { href: "/cart", key: "cart", Icon: ShoppingBag },
  { href: "/account", key: "account", Icon: CircleUser },
] as const;

export function BottomNav() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const { count } = useCart();
  const session = useSession();
  const avatar = () => session().data?.user.image ?? null;

  function isActive(href: string) {
    const rest = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    return href === "" ? rest === "/" : rest.startsWith(href);
  }

  return (
    <nav
      class="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/90 backdrop-blur-lg md:hidden"
      style={{ "padding-bottom": "env(safe-area-inset-bottom)" }}
    >
      <ul class="grid grid-cols-5">
        <For each={ITEMS}>
          {(item) => {
            const active = () => isActive(item.href);
            return (
              <li>
                <A
                  href={`/${locale()}${item.href}`}
                  class="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
                >
                  <span class="relative">
                    {item.key === "account" && avatar() ? (
                      <img
                        src={avatar() ?? undefined}
                        alt=""
                        referrerpolicy="no-referrer"
                        class={`h-[22px] w-[22px] rounded-full object-cover ${
                          active() ? "ring-2 ring-ink" : "ring-1 ring-line"
                        }`}
                      />
                    ) : (
                      <item.Icon
                        size={22}
                        stroke-width={active() ? 2.4 : 1.8}
                        class={active() ? "text-ink" : "text-soft"}
                      />
                    )}
                    {item.key === "cart" && count() > 0 && (
                      <span class="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                        {count()}
                      </span>
                    )}
                  </span>
                  <span class={`whitespace-nowrap text-[10px] leading-tight ${active() ? "text-ink" : "text-soft"}`}>
                    {t(`nav.${item.key}`)}
                  </span>
                  {active() && <span class="absolute -top-px h-0.5 w-8 rounded-full bg-accent" />}
                </A>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}
