import { PUBLIC_CORS, jsonResponse, preflight } from "@/lib/agent/config";
import { a2aDispatcher, agentCard } from "@/lib/agent/a2a";
import {
  RpcError,
  handleJsonRpc,
  readJsonBody,
  rpcError,
  rpcHttpResponse,
} from "@/lib/agent/jsonrpc";

// Point d'entrée A2A (JSON-RPC) : https://swiss3design.ch/a2a.
// Décrit par /.well-known/agent-card.json.
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
  const payload = await handleJsonRpc(body, a2aDispatcher({ request }));
  return rpcHttpResponse(payload);
}

// Un GET direct renvoie la carte de l'agent : pratique pour les clients qui
// découvrent l'agent depuis son URL de service.
export function GET() {
  return jsonResponse(agentCard());
}

export const OPTIONS = preflight;
