import { getUcp, ucpPreflight, updateUcp } from "@/lib/commerce/ucp-service";

// UCP — GET (lecture) et PUT (mise à jour) d'une session de checkout.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return getUcp(request, (await params).id);
}

export async function PUT(request: Request, { params }: Params) {
  return updateUcp(request, (await params).id);
}

export const OPTIONS = ucpPreflight;
