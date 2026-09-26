import { preflight } from "@/lib/agent/config";
import { queryArgs, toolResponse } from "@/lib/agent/http";

// GET /api/v1/products/vase-spirale?language=de
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return toolResponse(
    "get_product",
    { ...queryArgs(new URL(request.url)), slug },
    request,
  );
}

export const OPTIONS = preflight;
