import { preflight } from "@/lib/agent/config";
import { toolResponse } from "@/lib/agent/http";

// POST /api/v1/orders/track {"order_number":"S3D-1042","email":"…"}
// Même preuve de possession et même rate-limit que la page /track.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return toolResponse("track_order", body, request, "no-store");
}

export const OPTIONS = preflight;
