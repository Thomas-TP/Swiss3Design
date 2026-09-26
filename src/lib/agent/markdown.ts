// Markdown pour agents (négociation de contenu, comme « Markdown for Agents »
// de Cloudflare — réservé aux zones Pro, reproduit ici dans le Worker) : une
// page demandée avec « Accept: text/markdown » est rendue normalement, puis
// convertie. Ce module ne contient que la logique pure (testable) ; la
// conversion elle-même vit dans /api/agent/markdown.

const MARKDOWN_TYPES = ["text/markdown", "text/x-markdown"];

// Préférence Markdown selon RFC 9110 § 12.5.1 : q le plus élevé gagne, à q
// égal le premier cité. Un navigateur (text/html en tête, sans markdown) ne
// déclenche jamais la conversion.
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const ranges = accept.split(",").map((part, index) => {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return { type: type.trim(), q: q ? Number(q.slice(2)) || 0 : 1, index };
  });
  const best = (types: string[]) =>
    ranges
      .filter((r) => types.includes(r.type))
      .sort((a, b) => b.q - a.q || a.index - b.index)[0];
  const markdown = best(MARKDOWN_TYPES);
  if (!markdown || markdown.q === 0) return false;
  const html = best(["text/html", "application/xhtml+xml"]);
  if (!html) return true;
  return (
    markdown.q > html.q ||
    (markdown.q === html.q && markdown.index < html.index)
  );
}

// Pages convertibles : chemins localisés uniquement (/fr, /de/shop…). Ni API,
// ni fichiers, ni redirections de racine.
export function isMarkdownPath(pathname: string): boolean {
  return /^\/(fr|de|it|en)(\/|$)/.test(pathname) && !pathname.includes("..");
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : null;
}

export function extractDescription(html: string): string | null {
  const match =
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ??
    html.match(/<meta[^>]+content="([^"]*)"[^>]+name="description"/i);
  return match ? decodeEntities(match[1]) : null;
}

// Données structurées JSON-LD (prix, disponibilité, fil d'Ariane…) : très
// utiles aux agents, perdues par une conversion qui ne garde que le texte.
export function extractJsonLd(html: string): string[] {
  return Array.from(
    html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
    (m) => m[1].trim(),
  ).filter(Boolean);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Repli sans Workers AI (dev local, incident) : conversion rudimentaire du
// <main>, suffisante pour garder titres, paragraphes, listes et liens.
export function fallbackHtmlToMarkdown(html: string, origin: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const absolute = (href: string) =>
    href.startsWith("/") ? `${origin}${href}` : href;
  return decodeEntities(
    main
      .replace(/<(script|style|svg|noscript|template)[\s\S]*?<\/\1>/gi, "")
      .replace(
        /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
        (_m, level, inner) =>
          `\n\n${"#".repeat(Number(level))} ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`,
      )
      .replace(
        /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_m, href, inner) => {
          const text = inner.replace(/<[^>]+>/g, "").trim();
          return text ? `[${text}](${absolute(href)})` : "";
        },
      )
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<(br|\/p|\/div|\/section|\/article|\/ul|\/ol)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim(),
  );
}

export function frontmatter(fields: Record<string, string | null>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

// Estimation grossière (≈ 4 caractères par jeton) pour x-markdown-tokens,
// quand Workers AI ne renvoie pas le décompte exact.
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
