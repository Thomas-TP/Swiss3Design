import { AGENT_SURFACE_VERSION, STORE } from "./config";
import { RPC_ERRORS, RpcError } from "./jsonrpc";
import {
  ToolError,
  isToolName,
  runTool,
  toolDefinitions,
  type ToolContext,
} from "./tools";

// Serveur MCP (Model Context Protocol), transport Streamable HTTP sans état :
// chaque POST porte un message JSON-RPC complet, la réponse est un JSON
// (pas de flux SSE, pas d'Mcp-Session-Id). Suffisant pour des outils en
// lecture seule et compatible avec les clients MCP distants (Claude, ChatGPT,
// Cursor…).

// Du plus récent au plus ancien : on répond avec la version demandée si on la
// connaît, sinon avec la plus récente (négociation prévue par la spec).
export const MCP_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

export const MCP_SERVER_INFO = {
  name: "swiss3design",
  title: "Swiss3Design",
  version: AGENT_SURFACE_VERSION,
  websiteUrl: STORE.url,
  icons: [{ src: STORE.logo, mimeType: "image/png", sizes: ["192x192"] }],
};

export const MCP_INSTRUCTIONS =
  "Tools for Swiss3Design, a Swiss online store of 3D-printed design objects (prices in CHF, shipping to Switzerland only). Use search_products and get_product to find items, get_store_info for shipping/returns/payment, track_order to follow an order, and build_cart_link to hand the customer a ready-to-pay cart on swiss3design.ch.";

function negotiate(requested: unknown): string {
  return typeof requested === "string" &&
    (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_PROTOCOL_VERSIONS[0];
}

export function mcpDispatcher(ctx: ToolContext) {
  return async (method: string, params: unknown): Promise<unknown> => {
    const p = (params ?? {}) as Record<string, unknown>;
    switch (method) {
      case "initialize":
        return {
          protocolVersion: negotiate(p.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions: MCP_INSTRUCTIONS,
        };
      case "notifications/initialized":
      case "notifications/cancelled":
        return {};
      case "ping":
        return {};
      case "tools/list":
        return { tools: toolDefinitions() };
      case "tools/call": {
        if (!isToolName(p.name))
          throw new RpcError(
            RPC_ERRORS.invalidParams,
            `Unknown tool: ${String(p.name)}`,
          );
        try {
          const data = await runTool(p.name, p.arguments, ctx);
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
            isError: false,
          };
        } catch (error) {
          // Échec d'exécution → résultat isError (le modèle peut corriger ses
          // arguments), pas une erreur de protocole.
          if (error instanceof ToolError)
            return {
              content: [
                { type: "text", text: `${error.code}: ${error.message}` },
              ],
              isError: true,
            };
          throw error;
        }
      }
      default:
        throw new RpcError(
          RPC_ERRORS.methodNotFound,
          `Method not found: ${method}`,
        );
    }
  };
}
