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

Everything below is public and needs no API key. Prices are in CHF; delivery is within Switzerland only. Never invent prices, stock or policies: read them from these endpoints.

## Endpoints

| Surface | URL | Description |
| --- | --- | --- |
| MCP (Streamable HTTP) | ${abs(PATHS.mcp)} | JSON-RPC over POST, stateless. Card: ${abs(PATHS.mcpServerCard)} |
| A2A (JSON-RPC) | ${abs(PATHS.a2a)} | \`message/send\` (A2A 0.3) and \`SendMessage\` (A2A 1.0). Card: ${abs(PATHS.agentCard)} |
| REST API | ${abs(PATHS.api)} | OpenAPI 3.1: ${abs(PATHS.openapi)} |
| WebMCP | ${STORE.url} | Tools registered with \`navigator.modelContext\` on every page |
| Markdown | any page | Send \`Accept: text/markdown\` to get a page as Markdown |

## Tools

The same tools are exposed over MCP, A2A (as skills) and REST:

${tools}

## Buying

Use \`build_cart_link\` to validate items and get a link that fills the customer's cart on swiss3design.ch; the customer then pays on the website (TWINT, Visa, Mastercard, Google Pay).

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
