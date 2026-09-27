import { acpPreflight, createAcp } from "@/lib/commerce/acp-service";

// ACP — POST /api/acp/checkout_sessions : ouvre une session de checkout.
export const dynamic = "force-dynamic";

export const POST = createAcp;
export const OPTIONS = acpPreflight;
