import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { ThemeManager } from "@/components/theme-manager";
import { JsonLd } from "@/components/json-ld";
import { SITE_URL, siteJsonLd } from "@/lib/seo";
import { PATHS } from "@/lib/agent/paths";
import { archivo, geist, geistMono } from "./fonts";
import "./globals.css";

// Layout RACINE (le seul document <html>), au-dessus du segment [locale].
//
// Pourquoi ici et plus dans [locale]/layout.tsx : une URL inconnue (/fr/zzz)
// ne correspond à aucune route. Next la sert alors par la route interne
// /_not-found, qui ne rend QUE le layout racine et le not-found.tsx racine,
// jamais les layouts des segments dynamiques. Avec le <html> dans [locale],
// il n'y avait pas de layout racine : la 404 passait par un [...rest] qui
// appelait notFound(), et un notFound() lancé pendant le rendu fait échouer la
// « coquille » React (Fizz n'a pas de limites d'erreur côté serveur) : Next
// retombe alors sur <html id="__next_error__"> au corps vide et la page ne
// s'écrit qu'après l'hydratation. Ici, /_not-found est rendue entièrement côté
// serveur (en-tête, h1, pied de page), avec un vrai statut 404.
//
// La langue vient de next-intl (en-tête posé par le middleware), pas d'un
// paramètre de route : ce layout est partagé par toutes les langues et n'est
// donc pas re-rendu au changement de langue (voir <HtmlLangSync>).

// Métadonnées PAR DÉFAUT : chaque page indexable pose les siennes via
// pageMetadata() (lib/seo.ts), avec canonical, hreflang et og:url. Ce socle ne
// sert qu'aux pages sans generateMetadata (espaces privés, en noindex).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "seo" });
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce CSP posé par le middleware (prod uniquement) : autorise le script
  // inline anti-flash sous une politique sans 'unsafe-inline'.
  const [requested, seo, requestHeaders, { cf }] = await Promise.all([
    getLocale(),
    getTranslations("seo"),
    headers(),
    getCloudflareContext({ async: true }),
  ]);
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${geistMono.variable} ${archivo.variable} antialiased`}
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
        {/* Applique le thème et la préférence de mouvement avant le 1er rendu :
            ni flash clair→sombre, ni animation lancée puis coupée. data-motion
            vaut « reduce » ou « full » : choix explicite de l'interrupteur du
            footer (localStorage « s3d-motion »), sinon prefers-reduced-motion.
            Si le stockage est bloqué, <html> reste sans data-motion : le CSS
            retombe sur la préférence OS et les révélations restent dans leur
            état final. Sur les navigations sans rechargement (langue, retour
            arrière), le relais du thème est pris par <ThemeManager>.
            L'attribut suppressHydrationWarning de <html> couvre ces écritures. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';var m=null;try{m=localStorage.getItem('s3d-motion')}catch(e){}var rm=m?m==='reduce':matchMedia('(prefers-reduced-motion: reduce)').matches;r.dataset.motion=rm?'reduce':'full';}catch(e){}})();`,
          }}
        />
        {/* Données structurées de l'entreprise + du site (OnlineStore +
            WebSite, référencés par @id depuis les schémas de chaque page). */}
        <JsonLd data={siteJsonLd(locale, seo("organizationDescription"))} />
        {/* Catalogue ARD (ce que les agents peuvent utiliser ici) ; React 19
            remonte ce <link> dans le <head>. */}
        <link rel="ai-catalog" href={PATHS.aiCatalog} type="application/json" />
        <ThemeManager />
        {children}
      </body>
    </html>
  );
}
