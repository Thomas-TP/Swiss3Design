import { PUBLIC_CORS, preflight } from "@/lib/agent/config";
import {
  accountMcpDispatcher,
  authenticateAccountRequest,
  missingScope,
  unauthorized,
} from "@/lib/agent/account-mcp";
import {
  RpcError,
  handleJsonRpc,
  readJsonBody,
  rpcError,
  rpcHttpResponse,
} from "@/lib/agent/jsonrpc";

// Serveur MCP « compte client » (Streamable HTTP, sans état) :
// https://swiss3design.ch/mcp/account. Protégé par OAuth 2.1 — voir
// /.well-known/oauth-protected-resource/mcp/account et /auth.md.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateAccountRequest(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return new Response(JSON.stringify(rpcError(null, error as RpcError)), {
      status: 400,
      headers: { "Content-Type": "application/json", ...PUBLIC_CORS },
    });
  }
  const scope = missingScope(body, auth.principal);
  if (scope)
    return unauthorized(
      auth.principal.issuer,
      {
        code: "insufficient_scope",
        description: `This tool requires the ${scope} scope.`,
        scope: [scope],
      },
      403,
    );
  const payload = await handleJsonRpc(
    body,
    accountMcpDispatcher(auth.principal, { request }),
  );
  return rpcHttpResponse(payload);
}

// Sans jeton, tout verbe renvoie le défi 401 (découverte OAuth) ; avec jeton,
// pas de flux SSE serveur→client : 405 comme le permet la spec.
async function notSupported(request: Request) {
  const auth = await authenticateAccountRequest(request);
  if (!auth.ok) return auth.response;
  return new Response("This MCP endpoint accepts JSON-RPC over POST only.", {
    status: 405,
    headers: { Allow: "POST, OPTIONS", ...PUBLIC_CORS },
  });
}

export const GET = notSupported;
export const DELETE = notSupported;
export const OPTIONS = preflight;
