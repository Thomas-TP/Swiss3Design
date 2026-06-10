import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerSession } from "@/lib/session";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/svg+xml", "svg"],
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo

export async function POST(request: Request) {
  const session = await getServerSession();
  if (session?.user.role !== "admin") {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file" }, { status: 400 });
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return Response.json({ error: "unsupported_type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const key = `products/${crypto.randomUUID()}.${ext}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.R2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ url: `/api/files/${key}` });
}
