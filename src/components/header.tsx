"use client";

import { CircleUser, Heart, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { SessionAvatar } from "./session-avatar";
import { ThemeToggle } from "./theme-toggle";
import { CountBadge } from "./ui/count-badge";
import { NavPending } from "./ui/nav-pending";
import { SiteLink } from "./ui/site-link";
// Ancrage de la BottomNav, du bandeau et de nav-mark pendant la « Coupe » :
// importé ici parce que le header est rendu sur toutes les pages.
import "./ui/page-cut.css";

// Header « Strates » (brief §7.1). 64 px (offsets top-16, top-24, scroll-mt-32
// inchangés), papier translucide + flou, filet bas. Ancré pendant la « Coupe »
// (view-transition-name: site-header, globals.css) : la page s'imprime
// dessous, lui ne bouge pas. Calque 40.
//
// Centre (≥ lg) : Boutique · Studio · Sur mesure · Atelier, en texte. Actif =
// encre + soulignement rouge de 2 px nommé `nav-mark`, qui glisse d'un onglet à
// l'autre pendant la transition ; au survol, un soulignement encre se trace de
// gauche à droite (280 ms). Plus de pill Framer Motion : aucun import de
// `motion` ici. Bord inférieur : filet de progression du défilement
// (--s3d-progress, écrit par le runtime dans les pages vitrine seulement ;
// ailleurs la variable est absente, le filet vaut 0) et buse d'attente.
//
// À préserver : hasSession (cookie, sans requête DB) → SessionAvatar ;
// compteurs useCart()/useFavorites() ; aria-current="page" ; noms accessibles
// des icônes ; wordmark masqué sous 360 px ; liens @/i18n/navigation.

const LINKS = [
  { href: "/shop", key: "shop", also: ["/products"] },
  { href: "/studio", key: "studio", also: [] },
  { href: "/custom", key: "custom", also: [] },
  { href: "/a-propos", key: "atelier", also: [] },
] as const;

const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function Header({ hasSession = false }: { hasSession?: boolean }) {
  const t = useTranslations("nav");
  const shell = useTranslations("shell");
  const pathname = usePathname();
  const { count } = useCart();
  const { count: favCount } = useFavorites();

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-lg"
      style={{ viewTransitionName: "site-header" }}
    >
      {/* Second lien d'évitement (le premier, « Aller au contenu », est dans
          le layout) : sur une longue page vitrine, le pied de page porte les
          préférences (thème du mouvement) et les liens légaux. */}
      <a
        href="#site-footer"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-elevated focus:p-4"
      >
        {shell("skip.footer")}
      </a>
      <div className="s3d-page relative flex h-16 items-center justify-between gap-3">
        <SiteLink
          href="/"
          className="flex items-center gap-2 sm:gap-2.5"
          aria-label="Swiss3Design"
        >
          <BrandMark className="h-7 w-7" />
          <span className="hidden text-[15px] tracking-tight text-ink min-[360px]:inline sm:text-[17px]">
            <span className="font-medium">Swiss</span>
            <span className="font-bold">3Design</span>
          </span>
        </SiteLink>

        <nav
          aria-label={shell("nav.primary")}
          className="absolute left-1/2 hidden -translate-x-1/2 lg:block"
        >
          <ul className="flex items-center gap-8">
            {LINKS.map(({ href, key, also }) => {
              const active =
                within(pathname, href) ||
                also.some((base) => within(pathname, base));
              return (
                <li key={key}>
                  <SiteLink
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-16 items-center text-sm font-medium transition-colors duration-150 ${
                      active ? "text-ink" : "text-soft hover:text-ink"
                    }`}
                  >
                    {shell(`nav.${key}`)}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-4 h-0.5 bg-accent"
                        style={{ viewTransitionName: "nav-mark" }}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-4 h-0.5 origin-left scale-x-0 bg-ink transition-transform duration-280 ease-strate group-hover:scale-x-100 group-focus-visible:scale-x-100"
                      />
                    )}
                  </SiteLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
          <SiteLink
            href="/favorites"
            aria-label={shell("nav.favoritesCount", { count: favCount })}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-field text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink"
          >
            <Heart size={19} strokeWidth={1.5} />
            <CountBadge
              count={favCount}
              className="absolute right-0.5 top-0.5"
            />
          </SiteLink>
          <SiteLink
            href="/account"
            aria-label={t("account")}
            className="hidden h-10 w-10 items-center justify-center rounded-field text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink md:inline-flex"
          >
            {hasSession ? (
              <SessionAvatar />
            ) : (
              <CircleUser size={19} strokeWidth={1.5} />
            )}
          </SiteLink>
          <SiteLink
            href="/cart"
            aria-label={shell("nav.cartCount", { count })}
            className="hidden h-10 items-center gap-2 rounded-field px-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-line/60 md:inline-flex"
          >
            <ShoppingBag size={19} strokeWidth={1.5} className="text-soft" />
            <span>{t("cart")}</span>
            <CountBadge count={count} />
          </SiteLink>
        </div>
      </div>
      <span aria-hidden="true" className="s3d-progress" />
      <NavPending />
    </header>
  );
}
