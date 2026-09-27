import { PUBLIC_CORS } from "./config";

// JSON-RPC 2.0 minimal, commun au serveur MCP et à l'agent A2A : les deux
// protocoles l'utilisent sur un simple POST HTTP. Sans état ni session —
// chaque requête est autonome, ce qui convient à un Worker.

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export const RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

export const rpcResult = (id: JsonRpcId, result: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  result,
});

export const rpcError = (id: JsonRpcId, error: RpcError) => ({
  jsonrpc: "2.0" as const,
  id,
  error: {
    code: error.code,
    message: error.message,
    ...(error.data !== undefined && { data: error.data }),
  },
});

function isRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as JsonRpcRequest).jsonrpc === "2.0" &&
    typeof (value as JsonRpcRequest).method === "string"
  );
}

type Dispatch = (method: string, params: unknown) => Promise<unknown>;

// Traite un corps JSON-RPC (objet ou lot). Les notifications (sans id) ne
// produisent pas de réponse : un lot composé uniquement de notifications
// renvoie null, que l'appelant traduit en 202 Accepted.
export async function handleJsonRpc(
  body: unknown,
  dispatch: Dispatch,
): Promise<unknown> {
  const one = async (message: unknown) => {
    if (!isRequest(message))
      return rpcError(
        null,
        new RpcError(RPC_ERRORS.invalidRequest, "Invalid JSON-RPC request"),
      );
    const isNotification = message.id === undefined;
    try {
      const result = await dispatch(message.method, message.params);
      return isNotification ? null : rpcResult(message.id ?? null, result);
    } catch (error) {
      if (isNotification) return null;
      const rpc =
        error instanceof RpcError
          ? error
          : new RpcError(RPC_ERRORS.internal, "Internal error");
      if (!(error instanceof RpcError)) console.error("[jsonrpc]", error);
      return rpcError(message.id ?? null, rpc);
    }
  };
  if (Array.isArray(body)) {
    if (body.length === 0)
      return rpcError(
        null,
        new RpcError(RPC_ERRORS.invalidRequest, "Empty batch"),
      );
    const responses = (await Promise.all(body.map(one))).filter(Boolean);
    return responses.length > 0 ? responses : null;
  }
  return one(body);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RpcError(RPC_ERRORS.parse, "Parse error");
  }
}

export function rpcHttpResponse(
  payload: unknown,
  headers: Record<string, string> = {},
): Response {
  if (payload === null)
    return new Response(null, { status: 202, headers: PUBLIC_CORS });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...PUBLIC_CORS,
      ...headers,
    },
  });
}
