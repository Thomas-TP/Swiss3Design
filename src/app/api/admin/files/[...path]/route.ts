import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerSession } from "@/lib/session";

// Téléchargement admin des fichiers privés (modèles 3D des devis)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getServerSession();
  if (session?.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { path } = await params;
  const key = path.join("/");
  if (!key.startsWith("quotes/")) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.R2.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const fileName = key.split("/").pop() ?? "model.stl";
  return new Response(object.body as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
