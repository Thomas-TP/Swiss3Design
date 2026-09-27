import { PATHS, PUBLIC_CORS, STORE, abs } from "@/lib/agent/config";
import { SKILLS, skillPath } from "@/lib/agent/skills";
import { toolDefinitions } from "@/lib/agent/tools";

// /agents.md : documentation des surfaces agents (relation service-doc du
// catalogue d'API et des en-têtes Link). Liste d'outils générée depuis le
// registre : impossible d'oublier un outil ou d'en décrire un qui n'existe plus.
export function GET() {
  const tools = toolDefinitions()
    .map((t) => `- \`${t.name}\` — ${t.description}`)
    .join("\n");
  const skills = SKILLS.map(
    (s) => `- [${s.name}](${abs(skillPath(s.name))}) — ${s.description}`,
  ).join("\n");
  const body = `# Swiss3Design for AI agents

${STORE.description}

The catalogue, store and tracking surfaces below are public and need no API key; only the customer-account server requires the customer's consent (see "Customer account"). Prices are in CHF; delivery is within Switzerland only. Never invent prices, stock or policies: read them from these endpoints.

## Endpoints

| Surface | URL | Description |
| --- | --- | --- |
| MCP (Streamable HTTP) | ${abs(PATHS.mcp)} | JSON-RPC over POST, stateless. Card: ${abs(PATHS.mcpServerCard)} |
| MCP customer account | ${abs(PATHS.mcpAccount)} | Same transport, OAuth 2.1 bearer token required: ${abs(PATHS.authMd)} |
| A2A (JSON-RPC) | ${abs(PATHS.a2a)} | \`message/send\` (A2A 0.3) and \`SendMessage\` (A2A 1.0). Card: ${abs(PATHS.agentCard)} |
| REST API | ${abs(PATHS.api)} | OpenAPI 3.1: ${abs(PATHS.openapi)} |
| WebMCP | ${STORE.url} | Tools registered with \`navigator.modelContext\` on every page |
| Markdown | any page | Send \`Accept: text/markdown\` to get a page as Markdown |

## Tools

The same tools are exposed over MCP, A2A (as skills) and REST:

${tools}

## Buying

Use \`build_cart_link\` to validate items and get a link that fills the customer's cart on swiss3design.ch; the customer then pays on the website (TWINT, Visa, Mastercard, Google Pay).

## Customer account (with the customer's consent)

To read a customer's own orders, quote requests and profile, use the OAuth-protected MCP server at ${abs(PATHS.mcpAccount)}. Two ways to get the customer's consent — never ask for their password:

- OAuth 2.1 with PKCE and dynamic client registration (MCP clients, apps): the customer approves on swiss3design.ch.
- auth.md agent registration (agents without a browser redirect): the customer confirms a 6-digit code on swiss3design.ch.

Step-by-step instructions: ${abs(PATHS.authMd)}. Discovery: ${abs(`${PATHS.protectedResource}${PATHS.mcpAccount}`)} and ${abs(PATHS.authorizationServer)}. The customer can remove any agent at any time from their account.

## Skills

${skills}

## Discovery

- API catalog (RFC 9727): ${abs(PATHS.apiCatalog)}
- Agentic Resource Discovery: ${abs(PATHS.aiCatalog)}
- Agent skills index: ${abs(PATHS.agentSkills)}
- Site summary: ${abs(PATHS.llms)}

## Limits and contact

Order tracking is rate-limited per IP. Contact: ${STORE.email}.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
      ...PUBLIC_CORS,
    },
  });
}
