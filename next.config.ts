import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Donne accès aux bindings Cloudflare (D1, R2, KV) pendant `next dev`
initOpenNextCloudflareForDev();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Optimisation déléguée à Cloudflare Images au déploiement
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
