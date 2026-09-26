// Constantes de la mesure d'audience (PostHog, région UE — Francfort),
// partagées entre le middleware Edge et le navigateur. Ce module ne doit rien
// importer : le middleware le charge, et un import de posthog-js ici finirait
// dans le bundle du Worker (plafond de 3 Mio, AGENTS.md règle 10).

// Relais first-party : le navigateur n'appelle que swiss3design.ch, que le
// middleware relaie vers PostHog. Les bloqueurs de pub ciblent les domaines
// de mesure connus, pas un chemin propre au site. Sous /api/ : jamais de
// redirection de langue ni de www, et déjà exclu par robots.txt.
export const ANALYTICS_RELAY_PATH = "/api/relay";

export const POSTHOG_INGEST_HOST = "https://eu.i.posthog.com";
export const POSTHOG_ASSET_HOST = "https://eu-assets.i.posthog.com";
// Application PostHog (liens du toolbar, heatmaps) : jamais relayée.
export const POSTHOG_UI_HOST = "https://eu.posthog.com";

// Seul le domaine canonique mesure : ni dev, ni preview *.workers.dev.
export const ANALYTICS_HOSTNAME = "swiss3design.ch";
