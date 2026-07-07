import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // Sans ça, Turbopack remonte la racine du monorepo (présence d'un
  // package-lock.json à C:\Perso\Swiss3Design) et scanne/observe tout
  // l'arbre — y compris node_modules de apps/medusa et apps/storefront,
  // bien plus volumineux que cette app — d'où des temps de compilation/SSR
  // catastrophiques (~2 min) observés en dev tant que ce n'était pas fixé.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withNextIntl(nextConfig);
