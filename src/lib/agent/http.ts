import { jsonResponse } from "./config";
import { ToolError, runTool, type ToolName } from "./tools";

// Adaptateur REST des outils agents (/api/v1/…) : mêmes validations et mêmes
// réponses que MCP/A2A, erreurs traduites en statuts HTTP.
const STATUS: Record<ToolError["code"], number> = {
  invalid_arguments: 400,
  not_found: 404,
  rate_limited: 429,
};

export async function toolResponse(
  name: ToolName,
  args: unknown,
  request: Request,
  cache = "public, max-age=300",
): Promise<Response> {
  try {
    const data = await runTool(name, args, { request });
    return jsonResponse(data, { headers: { "Cache-Control": cache } });
  } catch (error) {
    if (error instanceof ToolError)
      return jsonResponse(
        { error: { code: error.code, message: error.message } },
        {
          status: STATUS[error.code],
          headers: { "Cache-Control": "no-store" },
        },
      );
    console.error(`[api/v1] ${name}`, error);
    return jsonResponse(
      { error: { code: "internal_error", message: "Unexpected error" } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// Paramètres de requête → arguments typés (les nombres et booléens arrivent
// en chaînes dans une URL).
export function queryArgs(url: URL): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    if (value === "") continue;
    if (value === "true" || value === "false") args[key] = value === "true";
    else if (/^\d+(\.\d+)?$/.test(value) && key !== "query")
      args[key] = Number(value);
    else args[key] = value;
  }
  return args;
}
