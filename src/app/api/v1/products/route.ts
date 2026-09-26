import { preflight } from "@/lib/agent/config";
import { queryArgs, toolResponse } from "@/lib/agent/http";

// GET /api/v1/products?query=vase&max_price_chf=50&language=fr
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return toolResponse(
    "search_products",
    queryArgs(new URL(request.url)),
    request,
  );
}

export const OPTIONS = preflight;
