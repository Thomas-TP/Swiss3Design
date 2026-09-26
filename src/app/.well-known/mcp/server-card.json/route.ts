import { jsonResponse, preflight } from "@/lib/agent/config";
import { mcpServerCard } from "@/lib/agent/discovery";

// Carte du serveur MCP (SEP-1649 / SEP-2127) → point d'entrée /mcp.
export function GET() {
  return jsonResponse(mcpServerCard(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export const OPTIONS = preflight;
