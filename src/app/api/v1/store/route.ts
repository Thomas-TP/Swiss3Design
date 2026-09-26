import { preflight } from "@/lib/agent/config";
import { queryArgs, toolResponse } from "@/lib/agent/http";

// GET /api/v1/store : livraison, retours, paiement, contact, sur-mesure.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return toolResponse(
    "get_store_info",
    queryArgs(new URL(request.url)),
    request,
  );
}

export const OPTIONS = preflight;
