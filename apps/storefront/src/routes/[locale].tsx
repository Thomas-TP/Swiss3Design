import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { createMemo } from "solid-js";
import { isLocale, DEFAULT_LOCALE } from "../i18n/messages";
import { I18nProvider } from "../i18n/context";
import { CartProvider } from "../lib/cart";
import { FavoritesProvider } from "../lib/favorites";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { BottomNav } from "../components/bottom-nav";

// Layout partagé de toutes les pages /:locale/* — miroir de
// src/app/[locale]/layout.tsx côté app Next.js (fournisseurs i18n/panier/
// favoris, header/footer/nav mobile).
export default function LocaleLayout(props: RouteSectionProps) {
  const localeParam = () => props.params.locale ?? "";

  return (
    <>
      {!isLocale(localeParam()) ? (
        <Navigate href={`/${DEFAULT_LOCALE}`} />
      ) : (
        (() => {
          const locale = createMemo(() => {
            const value = localeParam();
            return isLocale(value) ? value : DEFAULT_LOCALE;
          });
          return (
            <I18nProvider locale={locale}>
              <CartProvider>
                <FavoritesProvider>
                  <Header />
                  <main class="flex-1 pb-24 md:pb-0">{props.children}</main>
                  <Footer />
                  <BottomNav />
                </FavoritesProvider>
              </CartProvider>
            </I18nProvider>
          );
        })()
      )}
    </>
  );
}
