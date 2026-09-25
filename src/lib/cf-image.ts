// Cloudflare Images — Transformations (activé sur la zone, « This zone only »).
//
// Réécrit une image servie depuis /api/files vers une URL transformée
// `/cdn-cgi/image/<options>/<source>` : redimensionnement + `format=auto`
// (WebP/AVIF selon le navigateur) → LCP nettement plus léger.
//
// Le edge Cloudflare n'intercepte `/cdn-cgi/image` qu'EN PRODUCTION : en
// `npm run dev` (et en `npm run preview` local) cette route n'existe pas, donc
// on renvoie l'URL d'origine. `onerror=redirect` est un filet supplémentaire :
// si une transformation échoue côté edge, Cloudflare sert l'original.
export function cfImage(
  url: string | null | undefined,
  opts: { width: number; quality?: number },
): string | undefined {
  if (!url) return undefined;
  // On ne transforme que nos images locales (chemin relatif /api/files/…).
  // Les URL externes (avatars Google, etc.) passent telles quelles.
  if (
    !url.startsWith("/api/files/") ||
    /\.svg(?:[?#]|$)/i.test(url) ||
    process.env.NODE_ENV !== "production"
  ) {
    return url;
  }
  const params = [
    "format=auto",
    `width=${opts.width}`,
    `quality=${opts.quality ?? 82}`,
    "fit=cover",
    "onerror=redirect",
  ].join(",");
  return `/cdn-cgi/image/${params}${url}`;
}

/**
 * Image de partage (og:image) d'une photo produit : JPEG 1200×630, le seul
 * format/ratio lu de façon fiable par tous les réseaux (WhatsApp, LinkedIn,
 * Facebook…) — nos originaux sont en WebP carré. `fit=pad` ajoute des marges
 * couleur papier au lieu de rogner l'objet. Hors production (pas de
 * /cdn-cgi/image), renvoie `null` : l'appelant garde alors l'original.
 */
export function cfOgImage(url: string | null | undefined): string | null {
  if (
    !url?.startsWith("/api/files/") ||
    /\.svg(?:[?#]|$)/i.test(url) ||
    process.env.NODE_ENV !== "production"
  ) {
    return null;
  }
  const params = [
    "format=jpeg",
    "width=1200",
    "height=630",
    "fit=pad",
    "background=%23fafaf9",
    "quality=85",
    "onerror=redirect",
  ].join(",");
  return `/cdn-cgi/image/${params}${url}`;
}
