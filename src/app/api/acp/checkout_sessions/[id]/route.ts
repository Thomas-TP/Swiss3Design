import { acpPreflight, getAcp, updateAcp } from "@/lib/commerce/acp-service";

// ACP — GET (lecture) et POST (mise à jour) d'une session de checkout.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return getAcp(request, (await params).id);
}

export async function POST(request: Request, { params }: Params) {
  return updateAcp(request, (await params).id);
}

export const OPTIONS = acpPreflight;
