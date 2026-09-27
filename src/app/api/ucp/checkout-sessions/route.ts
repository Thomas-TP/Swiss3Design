import { createUcp, ucpPreflight } from "@/lib/commerce/ucp-service";

// UCP — POST /api/ucp/checkout-sessions : ouvre une session de checkout.
export const dynamic = "force-dynamic";

export const POST = createUcp;
export const OPTIONS = ucpPreflight;
