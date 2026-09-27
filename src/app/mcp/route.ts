import { PUBLIC_CORS, preflight } from "@/lib/agent/config";
import {
  RpcError,
  handleJsonRpc,
  readJsonBody,
  rpcError,
  rpcHttpResponse,
} from "@/lib/agent/jsonrpc";
import { mcpDispatcher } from "@/lib/agent/mcp";

// Point d'entrée MCP (Streamable HTTP) : https://swiss3design.ch/mcp.
// Décrit par /.well-known/mcp/server-card.json.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return new Response(JSON.stringify(rpcError(null, error as RpcError)), {
      status: 400,
      headers: { "Content-Type": "application/json", ...PUBLIC_CORS },
    });
  }
  const payload = await handleJsonRpc(body, mcpDispatcher({ request }));
  return rpcHttpResponse(payload);
}

// Pas de flux serveur→client (SSE) : la spec autorise un 405 sur GET.
export function GET() {
  return new Response("This MCP endpoint accepts JSON-RPC over POST only.", {
    status: 405,
    headers: { Allow: "POST, OPTIONS", ...PUBLIC_CORS },
  });
}

export const DELETE = GET;
export const OPTIONS = preflight;
