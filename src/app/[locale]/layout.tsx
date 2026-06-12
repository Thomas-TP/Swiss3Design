import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import "../globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const META: Record<string, { title: string; description: string }> = {
  fr: {
    title: "Impression 3D multicolore en Suisse",
    description:
      "Objets design imprimés en 3D jusqu'à 4 couleurs, fabriqués à Gland et livrés dans toute la Suisse.",
  },
  de: {
    title: "Mehrfarbiger 3D-Druck in der Schweiz",
    description:
      "3D-gedruckte Designobjekte mit bis zu 4 Farben, gefertigt in Gland und in die ganze Schweiz geliefert.",
  },
  it: {
    title: "Stampa 3D multicolore in Svizzera",
    description:
      "Oggetti di design stampati in 3D fino a 4 colori, realizzati a Gland e consegnati in tutta la Svizzera.",
  },
  en: {
    title: "Multicolor 3D printing in Switzerland",
    description:
      "Design objects 3D-printed in up to 4 colors, made in Gland and delivered across Switzerland.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = META[locale] ?? META.fr;
  return {
    title: {
      default: `Swiss3Design — ${meta.title}`,
      template: "%s · Swiss3Design",
    },
    description: meta.description,
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

  return (
    <html lang={locale} className={`${geist.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
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
