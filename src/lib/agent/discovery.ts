import { AGENT_SURFACE_VERSION, PATHS, STORE, abs } from "./config";
import {
  MCP_INSTRUCTIONS,
  MCP_PROTOCOL_VERSIONS,
  MCP_SERVER_INFO,
} from "./mcp";
import { toolDefinitions } from "./tools";

// Documents de découverte servis sous /.well-known/ : catalogue d'API
// (RFC 9727), carte du serveur MCP, catalogue ARD (ai-catalog). Tous
// décrivent les mêmes points d'entrée réels (config.ts).

const docs = { href: abs(PATHS.agentsDoc), type: "text/markdown" };

export function apiCatalog() {
  return {
    linkset: [
      {
        anchor: abs(PATHS.api),
        "service-desc": [
          {
            href: abs(PATHS.openapi),
            type: "application/vnd.oai.openapi+json",
          },
        ],
        "service-doc": [docs],
        status: [
          { href: abs(`${PATHS.api}/health`), type: "application/json" },
        ],
      },
      {
        anchor: abs(PATHS.mcp),
        "service-desc": [
          { href: abs(PATHS.mcpServerCard), type: "application/json" },
        ],
        "service-doc": [docs],
      },
      {
        anchor: abs(PATHS.a2a),
        "service-desc": [
          { href: abs(PATHS.agentCard), type: "application/json" },
        ],
        "service-doc": [docs],
      },
    ],
  };
}

// Carte de serveur MCP : champs du format server.json du registre MCP
// (name, version, remotes…) ET champs attendus par les scanners
// (serverInfo, transport, capabilities) — les deux lectures coexistent.
export function mcpServerCard() {
  const endpoint = abs(PATHS.mcp);
  return {
    name: "ch.swiss3design/shop",
    title: MCP_SERVER_INFO.title,
    description:
      "Catalogue search, product details, store policies, order tracking and cart links for Swiss3Design, a Swiss store of multicolour 3D-printed design objects (CHF, shipping within Switzerland).",
    version: AGENT_SURFACE_VERSION,
    websiteUrl: STORE.url,
    icons: MCP_SERVER_INFO.icons,
    remotes: [{ type: "streamable-http", url: endpoint }],
    serverInfo: {
      name: MCP_SERVER_INFO.name,
      title: MCP_SERVER_INFO.title,
      version: MCP_SERVER_INFO.version,
    },
    protocolVersion: MCP_PROTOCOL_VERSIONS[0],
    supportedProtocolVersions: MCP_PROTOCOL_VERSIONS,
    transport: { type: "streamable-http", endpoint },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false, schemes: [] },
    instructions: MCP_INSTRUCTIONS,
    documentationUrl: abs(PATHS.agentsDoc),
    tools: toolDefinitions(),
    resources: [],
    prompts: [],
  };
}

export function aiCatalog() {
  return {
    specVersion: "1.0",
    host: {
      displayName: STORE.name,
      identifier: STORE.did,
      url: STORE.url,
      logo: STORE.logo,
    },
    entries: [
      {
        identifier: "urn:air:swiss3design.ch:server:shop",
        displayName: "Swiss3Design MCP server",
        description:
          "MCP tools to search the catalogue, read store policies, track orders and build cart links.",
        type: "application/mcp-server-card+json",
        url: abs(PATHS.mcpServerCard),
        representativeQueries: [
          "find a multicolour 3D-printed vase under 50 CHF",
          "what does shipping cost in Switzerland",
          "track my Swiss3Design order",
        ],
      },
      {
        identifier: "urn:air:swiss3design.ch:agent:shop-assistant",
        displayName: "Swiss3Design Shop Assistant (A2A)",
        description:
          "A2A agent answering product, shipping and order questions for Swiss3Design.",
        type: "application/a2a-agent-card+json",
        url: abs(PATHS.agentCard),
        representativeQueries: [
          "recommend a 3D-printed desk organiser made in Switzerland",
          "where is order S3D-1042",
        ],
      },
      {
        identifier: "urn:air:swiss3design.ch:skills:index",
        displayName: "Swiss3Design agent skills",
        description: "How to shop, track orders and request custom 3D prints.",
        type: "application/agent-skills+json",
        url: abs(PATHS.agentSkills),
        representativeQueries: [
          "how to buy from swiss3design.ch as an agent",
          "request a custom 3D print quote in Switzerland",
        ],
      },
      {
        identifier: "urn:air:swiss3design.ch:api:store",
        displayName: "Swiss3Design Store API",
        description:
          "Public REST API (OpenAPI 3.1): catalogue, store info, order tracking, cart links.",
        type: "application/vnd.oai.openapi+json",
        url: abs(PATHS.openapi),
        representativeQueries: [
          "list Swiss3Design products with prices in CHF",
          "Swiss3Design product catalogue API",
        ],
      },
    ],
  };
}
