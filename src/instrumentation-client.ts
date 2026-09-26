import {
  POSTHOG_TOKEN,
  analyticsAllowed,
  attachPostHog,
  posthogConfig,
  registerAnalyticsLoader,
} from "@/lib/analytics";

// Seul point d'import de posthog-js : ce fichier n'existe que dans le bundle
// navigateur, jamais dans le Worker (voir lib/analytics.ts).
let loading = false;
function load() {
  if (loading || !analyticsAllowed()) return;
  loading = true;
  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_TOKEN!, posthogConfig());
      attachPostHog(posthog);
    })
    .catch(() => {
      loading = false;
    });
}

registerAnalyticsLoader(load);

// Exécuté avant l'hydratation : on ne fait ici que programmer le chargement,
// une fois le navigateur au repos, pour ne rien retirer au premier rendu
// (LCP, INP). La page vue initiale est capturée à l'init ; les événements
// émis entre-temps attendent dans la file de lib/analytics.ts.
if ("requestIdleCallback" in window)
  window.requestIdleCallback(load, { timeout: 4000 });
else setTimeout(load, 2000);
