import { jsonResponse, preflight } from "@/lib/agent/config";
import { agentCard } from "@/lib/agent/a2a";

// Carte de l'agent A2A → point d'entrée /a2a.
export function GET() {
  return jsonResponse(agentCard(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export const OPTIONS = preflight;
