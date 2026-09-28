"use client";

import { CircleUser, Home, LayoutGrid, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { SessionAvatar } from "./session-avatar";
import { CountBadge } from "./ui/count-badge";
import { StrataIcon } from "./ui/icons";
import { SiteLink } from "./ui/site-link";

// BottomNav « Strates » (brief §7.2), sous lg seulement. Cinq entrées :
// Accueil · Boutique · STUDIO · Panier · Compte. Le Studio, axe central du
// site, est un disque rouge de 44 px au centre (StrataIcon blanc, 4,58:1),
// libellé dessous : c'est le « bouton principal » permanent du mobile. « Sur
// mesure » sort de la barre (accessible depuis l'accueil, le Studio et le
// footer). Masquée sur /studio/<objet> : la barre d'action du Studio la
// remplace (WP-STUDIO), à la même hauteur.
//
// Hauteur fixe de 64 px + safe-area, libellés alignés sur une même ligne de
// base en bas de la barre : le disque dépasse de quelques pixels vers le haut,
// le bandeau de consentement (bottom 4.5rem) et les toasts restent au-dessus ; <main> garde pb-24 et le
// footer pb-24 lg:pb-0. Filet actif rouge de 2 px en haut, nommé `nav-mark`
// comme celui du header (un seul des deux est rendu à une largeur donnée) ;
// la barre est ancrée pendant la « Coupe » (site-bottom-nav, page-cut.css).
//
// À préserver : fixed bottom-0 z-50, lg:hidden, env(safe-area-inset-bottom),
// badge du panier, SessionAvatar variant="bottom", aria-current="page".

const ICON = { size: 22, strokeWidth: 1.5 } as const;

const within = (pathname: string, base: string) =>
  base === "/"
    ? pathname === "/"
    : pathname === base || pathname.startsWith(`${base}/`);

export function BottomNav({ hasSession = false }: { hasSession?: boolean }) {
  const t = useTranslations("nav");
  const shell = useTranslations("shell");
  const pathname = usePathname();
  const { count } = useCart();

  // /studio/<objet> : la barre du Studio prend la place (l'index /studio garde la nav).
  if (/^\/studio\/[^/]+/.test(pathname)) return null;

  const items = [
    { href: "/", label: t("home"), active: within(pathname, "/") },
    {
      href: "/shop",
      label: shell("nav.shop"),
      active: within(pathname, "/shop") || within(pathname, "/products"),
    },
    {
      href: "/studio",
      label: shell("nav.studio"),
      active: within(pathname, "/studio"),
    },
    { href: "/cart", label: t("cart"), active: within(pathname, "/cart") },
    {
      href: "/account",
      label: t("account"),
      active: within(pathname, "/account"),
    },
  ] as const;

  const icon = (href: string, active: boolean) => {
    const tone = active ? "text-ink" : "text-soft";
    switch (href) {
      case "/":
        return <Home {...ICON} className={tone} />;
      case "/shop":
        return <LayoutGrid {...ICON} className={tone} />;
      case "/cart":
        return <ShoppingBag {...ICON} className={tone} />;
      default:
        return hasSession ? (
          <SessionAvatar variant="bottom" active={active} />
        ) : (
          <CircleUser {...ICON} className={tone} />
        );
    }
  };

  return (
    <nav
      aria-label={shell("nav.mobile")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/90 backdrop-blur-lg lg:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        viewTransitionName: "site-bottom-nav",
      }}
    >
      <ul className="grid h-16 grid-cols-5">
        {items.map(({ href, label, active }) => {
          const studio = href === "/studio";
          return (
            <li key={href} className="h-full">
              <SiteLink
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  href === "/cart"
                    ? shell("nav.cartCount", { count })
                    : undefined
                }
                className="relative flex h-full flex-col items-center justify-end gap-1 pb-2 text-[11px] font-medium leading-tight"
              >
                {studio ? (
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-150 hover:bg-accent-dark"
                  >
                    <StrataIcon size={22} />
                  </span>
                ) : (
                  <span className="relative">
                    {icon(href, active)}
                    {href === "/cart" && (
                      <CountBadge
                        count={count}
                        className="absolute -right-2 -top-1.5"
                      />
                    )}
                  </span>
                )}
                <span
                  className={`whitespace-nowrap ${active ? "text-ink" : "text-soft"}`}
                >
                  {label}
                </span>
                {active && !studio && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-px h-0.5 w-8 bg-accent"
                    style={{ viewTransitionName: "nav-mark" }}
                  />
                )}
              </SiteLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
