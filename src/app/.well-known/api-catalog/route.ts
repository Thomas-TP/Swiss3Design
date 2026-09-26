import { PATHS, PUBLIC_CORS, abs, preflight } from "@/lib/agent/config";
import { apiCatalog } from "@/lib/agent/discovery";

// Catalogue d'API (RFC 9727) : linkset des API publiques (REST, MCP, A2A).
const headers = {
  "Content-Type": "application/linkset+json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
  Link: `<${abs(PATHS.apiCatalog)}>; rel="api-catalog"`,
  ...PUBLIC_CORS,
};

export function GET() {
  return new Response(JSON.stringify(apiCatalog(), null, 2), { headers });
}

// RFC 9727 § 2 : un HEAD doit aussi répondre (en-tête Link, sans corps).
export function HEAD() {
  return new Response(null, { headers });
}

export const OPTIONS = preflight;
