import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import { ThemeManager } from "@/components/theme-manager";
import { JsonLd } from "@/components/json-ld";
import { SITE_URL, siteJsonLd } from "@/lib/seo";
import "../globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

// Métadonnées PAR DÉFAUT : chaque page indexable pose les siennes via
// pageMetadata() (lib/seo.ts), avec canonical, hreflang et og:url. Ce socle ne
// sert qu'aux pages sans generateMetadata (espaces privés, en noindex).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: "seo",
  });
  const title = t("homeTitle");
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: "%s · Swiss3Design",
    },
    description: t("homeDescription"),
    // Icônes déclarées à la main (et non via les conventions app/icon.png &
    // app/apple-icon.png) : Next inline les fichiers de ces conventions en
    // base64 DANS le bundle du Worker, qui est plafonné à 3 Mio — un jeu
    // d'icônes complet suffisait à faire échouer le deploy. Servies depuis
    // public/, elles passent par les static assets Cloudflare : hors bundle,
    // donc leur poids n'entre plus jamais dans ce plafond.
    icons: {
      icon: [
        { url: "/brand/app/icon.webp", type: "image/webp" },
        { url: "/brand/app/icon-192.png", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/brand/app/apple-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: "Swiss3Design",
      title,
      description: t("homeDescription"),
      images: [
        {
          url: "/brand/social/og-image.png",
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t("homeDescription"),
      images: ["/brand/social/og-image.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Nonce CSP posé par le middleware (prod uniquement) : autorise le script
  // inline anti-flash sous une politique sans 'unsafe-inline'.
  const [nav, seo, requestHeaders, cookieStore, { cf }] = await Promise.all([
    getTranslations("nav"),
    getTranslations("seo"),
    headers(),
    cookies(),
    getCloudflareContext({ async: true }),
  ]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const hasSession = cookieStore
    .getAll()
    .some(({ name }) => name.endsWith("better-auth.session_token"));

  return (
    <html
      lang={locale}
      className={`${geist.variable} antialiased`}
      suppressHydrationWarning
      // Localisation approximative du visiteur (pays, canton, ville), déduite
      // de son IP par Cloudflare, lue par la mesure d'audience : en mode sans
      // cookie, PostHog écarte l'IP avant tout enrichissement géographique.
      data-geo-country={cf?.country}
      data-geo-continent={cf?.continent}
      data-geo-region={cf?.region}
      data-geo-region-code={cf?.regionCode}
      data-geo-city={cf?.city}
      data-geo-tz={cf?.timezone}
    >
      <body className="flex min-h-screen flex-col">
        {/* Applique le thème avant le 1er rendu : évite le flash clair→sombre.
            Sur les navigations sans rechargement (langue, retour arrière), le
            relais est pris par <ThemeManager>. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        {/* Données structurées de l'entreprise + du site (OnlineStore +
            WebSite, référencés par @id depuis les schémas de chaque page). */}
        <JsonLd data={siteJsonLd(locale, seo("organizationDescription"))} />
        <ThemeManager />
        <NextIntlClientProvider>
          <CartProvider>
            <FavoritesProvider>
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
            </FavoritesProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
