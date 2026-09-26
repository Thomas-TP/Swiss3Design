// Chemins des surfaces agents, sans aucune dépendance : importé par le
// middleware (Edge), qui doit rester léger. Tout le reste passe par config.ts.

export const PATHS = {
  mcp: "/mcp",
  a2a: "/a2a",
  api: "/api/v1",
  openapi: "/openapi.json",
  agentsDoc: "/agents.md",
  llms: "/llms.txt",
  apiCatalog: "/.well-known/api-catalog",
  mcpServerCard: "/.well-known/mcp/server-card.json",
  agentCard: "/.well-known/agent-card.json",
  agentSkills: "/.well-known/agent-skills/index.json",
  aiCatalog: "/.well-known/ai-catalog.json",
} as const;

// Chemins exclus de next-intl dans le middleware : servis tels quels, sans
// préfixe de langue ni redirection (un 307 vers /fr/mcp casserait tout
// client MCP, A2A ou OAuth).
const AGENT_ROUTE_PREFIXES = ["/.well-known/", PATHS.mcp, PATHS.a2a] as const;

export function isAgentRoute(pathname: string): boolean {
  return AGENT_ROUTE_PREFIXES.some((prefix) =>
    prefix.endsWith("/")
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// En-tête Link des pages HTML (RFC 8288, RFC 9727 § 3) : un agent qui charge
// n'importe quelle page trouve le catalogue d'API, l'OpenAPI, la doc et le
// catalogue ARD sans deviner d'URL. Chemins relatifs : valables en preview.
export const AGENT_LINK_HEADER = [
  `<${PATHS.apiCatalog}>; rel="api-catalog"`,
  `<${PATHS.openapi}>; rel="service-desc"; type="application/vnd.oai.openapi+json"`,
  `<${PATHS.agentsDoc}>; rel="service-doc"; type="text/markdown"`,
  `<${PATHS.llms}>; rel="describedby"; type="text/plain"`,
  `<${PATHS.aiCatalog}>; rel="ai-catalog"; type="application/json"`,
].join(", ");
