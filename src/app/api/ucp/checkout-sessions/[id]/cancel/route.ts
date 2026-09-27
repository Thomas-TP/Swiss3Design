import { cancelUcp, ucpPreflight } from "@/lib/commerce/ucp-service";

// UCP — POST …/cancel : annule une session encore ouverte.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return cancelUcp(request, (await params).id);
}

export const OPTIONS = ucpPreflight;
