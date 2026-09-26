import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  estimateTokens,
  extractDescription,
  extractJsonLd,
  extractTitle,
  fallbackHtmlToMarkdown,
  frontmatter,
  isMarkdownPath,
} from "@/lib/agent/markdown";

// Cible interne de la négociation Markdown : le middleware réécrit ici toute
// page demandée avec « Accept: text/markdown » (l'URL vue par le client ne
// change pas). On rend la page HTML normale via le Worker lui-même, puis on
// convertit son <main> avec Workers AI (toMarkdown), JSON-LD en annexe.
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 300;

type ToMarkdownResult = {
  format?: string;
  data?: string;
  tokens?: number | string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Posé par le middleware (réécriture) ; le paramètre ?path= sert aux appels
  // directs. Validé ci-dessous dans les deux cas.
  const target =
    request.headers.get("x-markdown-path") ??
    url.searchParams.get("path") ??
    "";
  const pathname = target.split("?")[0];
  if (!isMarkdownPath(pathname))
    return new Response("Not found", { status: 404 });

  const { env, ctx } = await getCloudflareContext({ async: true });
  const pageUrl = new URL(target, url.origin);
  const cacheKey = new Request(`${url.origin}/__markdown${target}`);
  const cache =
    typeof caches !== "undefined" && "default" in caches
      ? (caches as unknown as { default: Cache }).default
      : null;
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  // En prod, rendu via le binding sur soi-même (pas d'aller-retour Internet) ;
  // en dev, simple fetch vers le serveur local.
  const fetcher =
    process.env.NODE_ENV === "production" && env.WORKER_SELF_REFERENCE
      ? env.WORKER_SELF_REFERENCE
      : { fetch: (input: URL, init?: RequestInit) => fetch(input, init) };
  const page = await fetcher.fetch(pageUrl, {
    headers: {
      accept: "text/html",
      "user-agent": "Swiss3Design-Markdown/1.0",
    },
  });
  const html = await page.text();

  let body: string | null = null;
  let tokens: number | null = null;
  if (page.ok && env.AI) {
    try {
      const converted = (await env.AI.toMarkdown(
        { name: "page.html", blob: new Blob([html], { type: "text/html" }) },
        {
          conversionOptions: {
            html: { cssSelector: "main", hostname: url.hostname },
          },
        },
      )) as ToMarkdownResult | ToMarkdownResult[];
      const result = Array.isArray(converted) ? converted[0] : converted;
      if (result?.format === "markdown" && result.data?.trim()) {
        body = result.data
          // toMarkdown ajoute son propre frontmatter (entités non décodées) :
          // on garde le nôtre, plus complet.
          .replace(/^---\n[\s\S]*?\n---\n+/, "")
          // Liens relatifs → absolus : un agent lit ce texte hors du site.
          .replace(/\]\(\//g, `](${url.origin}/`)
          .trim();
        tokens = Number(result.tokens) || null;
      }
    } catch (error) {
      console.error("[markdown] toMarkdown", error);
    }
  }
  body ??= fallbackHtmlToMarkdown(html, url.origin);

  const jsonLd = extractJsonLd(html);
  const markdown =
    frontmatter({
      title: extractTitle(html),
      description: extractDescription(html),
      url: `${pageUrl.origin}${pageUrl.pathname}`,
      language: pathname.split("/")[1] ?? null,
    }) +
    body +
    (jsonLd.length > 0
      ? `\n\n## Structured data\n\n\`\`\`json\n${jsonLd.join("\n")}\n\`\`\`\n`
      : "\n");

  const response = new Response(markdown, {
    status: page.status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(tokens ?? estimateTokens(markdown)),
      "x-original-tokens": String(estimateTokens(html)),
      Link: `<${pageUrl.origin}${pageUrl.pathname}>; rel="canonical"; type="text/html"`,
      "Cache-Control": page.ok
        ? `public, max-age=${CACHE_SECONDS}`
        : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  if (page.ok && cache) ctx?.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
