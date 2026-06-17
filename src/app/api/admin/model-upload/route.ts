import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerSession } from "@/lib/session";

// Upload d'un modèle 3D pour le viewer produit. Validation par EXTENSION : les
// types MIME STL/GLB ne sont pas fiables (souvent application/octet-stream).
// Géométrie binaire → aucun risque d'exécution (contrairement au SVG). Stocké
// sous le préfixe `products/` (servi par /api/files comme les images).
const ALLOWED_EXT = new Set(["stl", "glb"]);
const CONTENT_TYPE: Record<string, string> = {
  stl: "model/stl",
  glb: "model/gltf-binary",
};
const MAX_BYTES = 25 * 1024 * 1024; // 25 Mo

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
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return Response.json({ error: "unsupported_type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const key = `products/${crypto.randomUUID()}.${ext}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.R2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: CONTENT_TYPE[ext] },
  });

  return Response.json({ url: `/api/files/${key}` });
}
