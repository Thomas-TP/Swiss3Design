// Preview publique (APP_ENV = "preview") : sa clé Resend envoie de vrais e-mails,
// donc seules les adresses autorisées en reçoivent et peuvent ouvrir un compte.
// Sans cela, n'importe quel visiteur de l'URL *.workers.dev ferait partir des
// e-mails au nom de swiss3design.ch vers l'adresse de son choix.
// Liste : secret PREVIEW_EMAIL_ALLOWLIST (adresses séparées par des virgules,
// posé avec `wrangler secret put PREVIEW_EMAIL_ALLOWLIST --env preview` : dépôt
// public, comme ADMIN_EMAILS), plus les adresses d'ADMIN_EMAILS. Secret absent
// en preview : aucune adresse autorisée (fermé par défaut). Hors preview
// (production, dev local) : aucun filtre.

interface PreviewEmailEnv {
  APP_ENV?: string;
  ADMIN_EMAILS?: string;
  PREVIEW_EMAIL_ALLOWLIST?: string;
}

const split = (list: string | undefined) =>
  (list ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Filtre des destinataires de la preview, ou null hors preview (tout passe). */
export function previewEmailGate(
  env: PreviewEmailEnv,
): ((email: string) => boolean) | null {
  if (env.APP_ENV !== "preview") return null;
  const allowed = new Set([
    ...split(env.PREVIEW_EMAIL_ALLOWLIST),
    ...split(env.ADMIN_EMAILS),
  ]);
  return (email) => allowed.has(email.trim().toLowerCase());
}

/** Destinataires qui passent le filtre (tous hors preview). */
export function allowedRecipients(
  env: PreviewEmailEnv,
  to: string | string[],
): string[] {
  const list = Array.isArray(to) ? to : [to];
  const gate = previewEmailGate(env);
  return gate ? list.filter(gate) : list;
}
