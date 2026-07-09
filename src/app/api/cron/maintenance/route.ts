import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerSession } from "@/lib/session";
import { runMaintenance } from "@/lib/maintenance";

// Purge des fichiers R2 orphelins + rétention des devis (>2 ans).
// Déclenchable par un admin connecté (bouton Réglages) ou par un planificateur
// externe via l'en-tête « Authorization: Bearer <CRON_SECRET> ».
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = request.headers.get("authorization") ?? "";
  const secretOk = !!env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`;

  if (!secretOk) {
    const session = await getServerSession();
    if (session?.user.role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const report = await runMaintenance();
  return Response.json(report);
}
