import { hasExpectedSignature } from "@/lib/file-signature";
import { boundedFormData } from "@/lib/upload";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerSession } from "@/lib/session";
import { isSessionFresh } from "@/lib/session-freshness";

// Formats raster uniquement : le SVG peut embarquer du JavaScript (XSS)
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo

export async function POST(request: Request) {
  const session = await getServerSession();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!isSessionFresh(session.session.createdAt)) {
    return Response.json({ error: "reauth_required" }, { status: 401 });
  }

  const form = await boundedFormData(request, MAX_BYTES);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file" }, { status: 400 });
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return Response.json({ error: "unsupported_type" }, { status: 415 });
  }
  if (!(await hasExpectedSignature(file, ext)))
    return Response.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  // "products" par défaut (usages existants) — les nouveaux appelants
  // peuvent préciser un dossier de rangement (ex. "newsletter").
  const folderRaw = String(form?.get("folder") || "products");
  const folder = /^[a-z-]+$/.test(folderRaw) ? folderRaw : "products";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ url: `/api/files/${key}` });
}
