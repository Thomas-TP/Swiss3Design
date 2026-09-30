import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { ConsentBanner } from "@/components/consent-banner";
import { WebMcpTools } from "@/components/webmcp-tools";
import { Footer } from "@/components/footer";
import { ReducedMotionConfig } from "@/components/reduced-motion-config";
import { HtmlLangSync } from "@/components/html-lang-sync";

// Habillage commun des pages : fournisseurs (messages, panier, favoris,
// mouvement), en-tête, <main>, pied de page, navigation mobile, bandeau de
// consentement. Partagé par deux appelants, pour que la 404 ait exactement le
// même cadre que les autres pages :
// - src/app/[locale]/layout.tsx, pour toute page qui correspond à une route ;
// - src/app/not-found.tsx, pour une URL sans route (/fr/zzz), que Next rend
//   sans passer par les layouts des segments dynamiques.
// Le <html>/<body> est dans src/app/layout.tsx (layout racine).
export async function LocaleShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [nav, cookieStore] = await Promise.all([
    getTranslations("nav"),
    cookies(),
  ]);
  const hasSession = cookieStore
    .getAll()
    .some(({ name }) => name.endsWith("better-auth.session_token"));

  return (
    <NextIntlClientProvider>
      <HtmlLangSync locale={locale} />
      <CartProvider>
        <FavoritesProvider>
          {/* motion/react suit la préférence du site (interrupteur du footer
              compris), pas seulement le réglage du système. */}
          <ReducedMotionConfig>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-4"
            >
              {nav("skipContent")}
            </a>
            <Header hasSession={hasSession} />
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 pb-24 lg:pb-0"
            >
              {children}
            </main>
            <Footer />
            <BottomNav hasSession={hasSession} />
            <ConsentBanner />
            <WebMcpTools />
          </ReducedMotionConfig>
        </FavoritesProvider>
      </CartProvider>
    </NextIntlClientProvider>
  );
}
