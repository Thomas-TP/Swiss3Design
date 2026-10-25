"use client";

import { useEffect, useState } from "react";
import { CircleUser, Heart, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { BrandLogo, BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { SessionAvatar } from "./session-avatar";
import { ThemeToggle } from "./theme-toggle";
import { CountBadge } from "./ui/count-badge";
import { NavPending } from "./ui/nav-pending";
import { SiteLink } from "./ui/site-link";
// Ancrage de la BottomNav, du bandeau et de nav-mark pendant la transition de
// page : importé ici parce que le header est rendu sur toutes les pages.
import "./ui/page-cut.css";

// Header qui se « rétracte » (25.10.2026, d'après printlab3d.ch et la barre
// d'onglets d'iOS 26) : en haut de page, pas de barre — logo, menu et actions
// posés à plat sur la page, sans fond ni filet, sur toute la largeur. Dès qu'on
// défile (> 24 px, `data-scrolled`), la barre se rétracte en pilule flottante :
// largeur réduite, coins arrondis, fond papier flouté, filet et ombre douce, posée
// à 8 px du haut, sur un ressort (léger dépassement puis retour, `--ease-spring`)
// ; une puce de statut (« Devis sous 48 h », point rouge qui respire) s'ouvre à
// côté du logo (≥ xl). Encombrement constant de 64 px (à plat : 64 ; pilule :
// 8 + 56), donc aucun saut de la page et des offsets top-16, top-24, scroll-mt-32.
// Tout est en transitions CSS (globals.css, `.s3d-hdr`) ; le seul JS est un
// écouteur de défilement passif, regroupé par image. Ancré pendant la transition
// de page (view-transition-name: site-header).
//
// Centre (≥ lg) : Boutique · Studio · Sur mesure · Atelier. Actif = une pastille
// d'encre claire nommée `nav-mark`, qui glisse d'un lien à l'autre pendant la
// transition de page ; au survol, une pastille de filet. Droite : thème, langue,
// favoris, compte, et le panier en bouton d'encre (l'action principale d'une
// boutique). Bord inférieur de la pilule : filet de progression du défilement
// (--s3d-progress, pages vitrine) et buse d'attente.
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

/** La page a-t-elle défilé de plus de `threshold` px ? (écouteur passif, une lecture par image) */
function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return scrolled;
}

export function Header({ hasSession = false }: { hasSession?: boolean }) {
  const t = useTranslations("nav");
  const shell = useTranslations("shell");
  const pathname = usePathname();
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const scrolled = useScrolled();

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      className="group/hdr sticky top-0 z-40 h-16"
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
      <div className="s3d-hdr relative flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-4">
          <SiteLink
            eager
            href="/"
            className="flex shrink-0 items-center gap-2 sm:gap-2.5"
            aria-label="Kreya"
          >
            {/* Logo complet dès 360 px ; en dessous, le symbole seul. */}
            <BrandMark className="h-7 w-auto min-[360px]:hidden" />
            <BrandLogo
              animated
              className="hidden h-[26px] w-auto text-ink min-[360px]:block sm:h-[28px]"
            />
          </SiteLink>
          {/* Statut, au défilement seulement (≥ xl). */}
          <span
            aria-hidden={scrolled ? undefined : true}
            className="hidden max-w-0 items-center gap-2 overflow-hidden whitespace-nowrap border-l border-transparent pl-0 opacity-0 transition-[max-width,opacity,padding,border-color] duration-500 ease-strate group-data-scrolled/hdr:max-w-[16rem] group-data-scrolled/hdr:border-line group-data-scrolled/hdr:pl-4 group-data-scrolled/hdr:opacity-100 xl:inline-flex"
          >
            <span className="s3d-live-dot" aria-hidden="true" />
            <span className="s3d-label text-soft">
              {shell("header.status")}
            </span>
          </span>
        </div>

        <nav aria-label={shell("nav.primary")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map(({ href, key, also }) => {
              const active =
                within(pathname, href) ||
                also.some((base) => within(pathname, base));
              return (
                <li key={key}>
                  <SiteLink
                    eager
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative isolate flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "text-ink"
                        : "text-soft hover:bg-line/50 hover:text-ink"
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 rounded-full bg-ink/[0.07] ring-1 ring-line"
                        style={{ viewTransitionName: "nav-mark" }}
                      />
                    ) : null}
                    {shell(`nav.${key}`)}
                  </SiteLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
          <SiteLink
            eager
            href="/favorites"
            aria-label={shell("nav.favoritesCount", { count: favCount })}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink"
          >
            <Heart size={19} strokeWidth={1.5} />
            <CountBadge
              count={favCount}
              className="absolute right-0.5 top-0.5"
            />
          </SiteLink>
          <SiteLink
            eager
            href="/account"
            aria-label={t("account")}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink md:inline-flex"
          >
            {hasSession ? (
              <SessionAvatar />
            ) : (
              <CircleUser size={19} strokeWidth={1.5} />
            )}
          </SiteLink>
          <SiteLink
            eager
            href="/cart"
            aria-label={shell("nav.cartCount", { count })}
            className="ml-1 hidden h-10 items-center gap-2 rounded-full bg-ink pl-3.5 pr-3 text-sm font-medium text-paper transition-[transform,background-color] duration-200 ease-strate hover:-translate-y-px hover:bg-ink/90 active:translate-y-0 md:inline-flex"
          >
            <ShoppingBag size={17} strokeWidth={1.75} />
            <span>{t("cart")}</span>
            <CountBadge count={count} />
          </SiteLink>
        </div>
        <span
          aria-hidden="true"
          className="s3d-progress ph-no-capture inset-x-4"
        />
        <NavPending />
      </div>
    </header>
  );
}
