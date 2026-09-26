import { jsonResponse, preflight } from "@/lib/agent/config";
import { aiCatalog } from "@/lib/agent/discovery";

// Catalogue ARD (Agentic Resource Discovery, modèle ai-catalog) : tout ce
// qu'un agent peut utiliser ici. CORS ouvert exigé par la spec.
export function GET() {
  return jsonResponse(aiCatalog(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const OPTIONS = preflight;
