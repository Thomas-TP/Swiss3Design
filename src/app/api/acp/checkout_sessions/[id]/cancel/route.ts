import { acpPreflight, cancelAcp } from "@/lib/commerce/acp-service";

// ACP — POST …/cancel : annule une session encore ouverte.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return cancelAcp(request, (await params).id);
}

export const OPTIONS = acpPreflight;
