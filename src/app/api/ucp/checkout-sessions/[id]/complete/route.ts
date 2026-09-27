import { completeUcp, ucpPreflight } from "@/lib/commerce/ucp-service";

// UCP — POST …/complete : paiement par Shared Payment Token, commande créée.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return completeUcp(request, (await params).id);
}

export const OPTIONS = ucpPreflight;
