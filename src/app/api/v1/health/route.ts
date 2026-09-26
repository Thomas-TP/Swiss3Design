import {
  AGENT_SURFACE_VERSION,
  jsonResponse,
  preflight,
} from "@/lib/agent/config";

// GET /api/v1/health : relation « status » du catalogue d'API (RFC 9727).
// Volontairement sans requête en base : dit si le service répond, pas plus.
export function GET() {
  return jsonResponse(
    { status: "ok", version: AGENT_SURFACE_VERSION },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const OPTIONS = preflight;
