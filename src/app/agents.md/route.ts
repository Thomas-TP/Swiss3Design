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

Prices in CHF, shipping within Switzerland only. Four ways to buy:

1. **Cart link** — \`build_cart_link\` validates items and returns a link that fills the customer's cart on swiss3design.ch; the customer pays on the website (TWINT, Visa, Mastercard, Google Pay).
2. **Machine payment (MPP)** — \`POST ${abs(`${PATHS.api}/purchases`)}\` with the items, the buyer's email and a Swiss address: the answer is \`402\` with the quote and a \`WWW-Authenticate: Payment\` challenge (\`method="stripe"\`, amount in CHF centimes). Pay it with a Stripe Shared Payment Token issued to the challenge's \`networkId\` — e.g. \`npx @stripe/link-cli mpp pay ${abs(`${PATHS.api}/purchases`)} -X POST -d '{…}'\` — and retry: \`201\`, the order and a \`Payment-Receipt\` header.
3. **ACP checkout** — discovery ${abs("/.well-known/acp.json")}; REST \`${abs("/api/acp")}/checkout_sessions\` (create, update, complete with \`payment_data.instrument.credential.token = "spt_…"\`, cancel). Payment handler \`dev.acp.tokenized.card\`, PSP Stripe.
4. **UCP checkout** — business profile ${abs("/.well-known/ucp")}; REST \`${abs("/api/ucp")}/checkout-sessions\` (create, update with PUT, complete, cancel). Payment handler \`ch.swiss3design.stripe_spt\` (Stripe Shared Payment Token): ${abs("/agents/ucp-stripe-spt.md")}.

The store's catalogue is also available to Stripe's partner AI agents, which check out through Stripe. Orders placed by an agent follow the store's terms (section on AI agents): ${STORE.url}/legal/terms.

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
