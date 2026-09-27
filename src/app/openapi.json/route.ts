import { jsonResponse, preflight } from "@/lib/agent/config";
import { openApiDocument } from "@/lib/agent/openapi";

// /openapi.json : description de l'API publique (relation service-desc du
// catalogue d'API et des en-têtes Link).
export function GET() {
  return jsonResponse(openApiDocument(), {
    headers: {
      "Content-Type": "application/vnd.oai.openapi+json; charset=utf-8",
    },
  });
}

export const OPTIONS = preflight;
