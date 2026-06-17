// Worker Cron dédié : déclenche la maintenance du site principal (purge R2 +
// relances de panier abandonné) toutes les heures. Séparé du worker OpenNext
// (qui n'expose qu'un handler `fetch`). Ne déploie rien — il appelle l'endpoint
// déjà protégé par CRON_SECRET.
//
// Déploiement (une seule fois, depuis ce dossier) :
//   npx wrangler deploy
//   npx wrangler secret put CRON_SECRET   # même valeur que le secret du site
interface Env {
  CRON_SECRET: string;
}

const MAINTENANCE_URL = "https://swiss3design.ch/api/cron/maintenance";

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const res = await fetch(MAINTENANCE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
        });
        if (!res.ok) {
          console.error(
            `[cron] maintenance ${res.status}: ${await res.text()}`,
          );
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
