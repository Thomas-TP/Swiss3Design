import { getCloudflareContext } from "@opennextjs/cloudflare";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Upload des modèles 3D joints aux demandes de devis (clients, y compris invités).
// Les fichiers vont dans le préfixe privé quotes/ — jamais servi publiquement,
// seul l'admin peut les télécharger via /api/admin/files.

const ALLOWED_EXTENSIONS = new Set(["stl", "3mf", "obj", "step", "stp"]);
const MAX_BYTES = 30 * 1024 * 1024; // 30 Mo

export async function POST(request: Request) {
  // Upload anonyme : sans limite, n'importe qui peut remplir le bucket R2
  if (!(await rateLimit(request, "quote-upload", { limit: 10, windowS: 3600 }))) {
    return tooManyRequests();
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return Response.json({ error: "unsupported_type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const key = `quotes/${crypto.randomUUID()}-${safeName}`;

  const { env } = await getCloudflareContext({ async: true });
  await env.R2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: "application/octet-stream" },
  });

  return Response.json({ key, fileName: file.name });
}
