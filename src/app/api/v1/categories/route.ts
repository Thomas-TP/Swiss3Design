import { preflight } from "@/lib/agent/config";
import { queryArgs, toolResponse } from "@/lib/agent/http";

// GET /api/v1/categories?language=it
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return toolResponse(
    "list_categories",
    queryArgs(new URL(request.url)),
    request,
  );
}

export const OPTIONS = preflight;
