import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import { ThemeManager } from "@/components/theme-manager";
import { organizationJsonLd } from "@/lib/seo";
import "../globals.css";

// Geist auto-hébergé via next/font/google (comme l'app Next.js racine) —
// plus besoin d'héberger manuellement un fichier woff2 (contrairement au
// storefront SolidStart, qui n'a pas d'équivalent next/font).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const META: Record<string, { title: string; description: string }> = {
  fr: {
    title: "Impression 3D multicolore en Suisse",
    description: "Objets design imprimés en 3D jusqu'à 4 couleurs, fabriqués à Gland et livrés dans toute la Suisse.",
  },
  de: {
    title: "Mehrfarbiger 3D-Druck in der Schweiz",
    description: "3D-gedruckte Designobjekte mit bis zu 4 Farben, gefertigt in Gland und in die ganze Schweiz geliefert.",
  },
  it: {
    title: "Stampa 3D multicolore in Svizzera",
    description: "Oggetti di design stampati in 3D fino a 4 colori, realizzati a Gland e consegnati in tutta la Svizzera.",
  },
  en: {
    title: "Multicolor 3D printing in Switzerland",
    description: "Design objects 3D-printed in up to 4 colors, made in Gland and delivered across Switzerland.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const meta = META[locale] ?? META.fr;
  const title = `Swiss3Design — ${meta.title}`;
  return {
    title: { default: title, template: "%s · Swiss3Design" },
    description: meta.description,
    openGraph: { type: "website", siteName: "Swiss3Design", locale, title, description: meta.description },
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

  // Nonce CSP posé par le middleware (prod uniquement) : autorise les
  // scripts inline sous une politique sans 'unsafe-inline'.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} className={`${geist.variable} antialiased`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <ThemeManager />
        <NextIntlClientProvider>
          <CartProvider>
            <FavoritesProvider>
              <Header />
              <main className="flex-1 pb-24 md:pb-0">{children}</main>
              <Footer />
              <BottomNav />
            </FavoritesProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
