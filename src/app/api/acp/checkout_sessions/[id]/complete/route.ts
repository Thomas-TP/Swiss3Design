import { acpPreflight, completeAcp } from "@/lib/commerce/acp-service";

// ACP — POST …/complete : paiement par Shared Payment Token, commande créée.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return completeAcp(request, (await params).id);
}

export const OPTIONS = acpPreflight;
