import { SITE_NAME, SITE_URL } from "@/lib/seo";

export { AGENT_LINK_HEADER, PATHS, isAgentRoute } from "./paths";

// Source unique des surfaces « agents » : serveur MCP, agent A2A, API
// publique, WebMCP et documents de découverte (/.well-known/…). Chaque carte
// (MCP, A2A, ARD, catalogue d'API, OpenAPI) cite ces mêmes URL et versions :
// en changer une ici la propage partout, sans carte qui mente.

export const AGENT_SURFACE_VERSION = "1.0.0";

export const abs = (path: string) => `${SITE_URL}${path}`;

export const STORE = {
  name: SITE_NAME,
  url: SITE_URL,
  email: "contact@swiss3design.ch",
  country: "CH",
  currency: "CHF",
  // Identifiant stable de l'hôte pour ARD (did:web = le domaine lui-même).
  did: "did:web:swiss3design.ch",
  logo: `${SITE_URL}/brand/app/icon-192.png`,
  description:
    "Swiss online store for 3D-printed design objects in up to 4 colours in a single piece, made in the Lake Geneva region and shipped only within Switzerland. Prices in CHF. Also offers custom 3D printing on quote.",
} as const;

// En-têtes CORS des surfaces publiques en lecture : un agent qui tourne dans
// un navigateur (WebMCP, extension) doit pouvoir les lire depuis n'importe
// quelle origine. Aucun cookie n'y transite (pas de credentials).
export const PUBLIC_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, A2A-Version",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      ...PUBLIC_CORS,
      ...init.headers,
    },
  });
}

export const preflight = () =>
  new Response(null, { status: 204, headers: PUBLIC_CORS });
