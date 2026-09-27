import { preflight } from "@/lib/agent/config";
import { toolResponse } from "@/lib/agent/http";

// POST /api/v1/cart-links {"items":[{"slug":"vase-spirale","color":"Rouge"}]}
// → lien swiss3design.ch qui remplit le panier du client.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return toolResponse("build_cart_link", body, request, "no-store");
}

export const OPTIONS = preflight;
