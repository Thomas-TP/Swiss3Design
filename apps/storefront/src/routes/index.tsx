import { Navigate } from "@solidjs/router";
import { DEFAULT_LOCALE } from "../i18n/messages";

// Détection de langue : simplifiée pour l'instant (toujours fr, comme
// DEFAULT_LOCALE côté app Next.js) — la négociation Accept-Language sera
// ajoutée avec le middleware Cloudflare Pages Functions (CSP/sécurité) qui
// portera aussi cette logique, pour ne pas la dupliquer.
export default function RootRedirect() {
  return <Navigate href={`/${DEFAULT_LOCALE}`} />;
}
