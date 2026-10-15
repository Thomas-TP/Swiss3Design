// Canal entre onglets d'un même navigateur (BroadcastChannel) pour la
// confirmation d'e-mail : la page « Adresse confirmée » annonce « verified » ;
// l'onglet resté sur l'inscription répond « ack » et se connecte (la session
// posée par la vérification vaut pour tout le navigateur). Sans réponse, la page
// de confirmation emmène elle-même vers le compte. Aucune donnée dans les
// messages : seulement leur type.
export const AUTH_CHANNEL = "s3d-auth";

export type AuthChannelMessage = { type: "verified" } | { type: "ack" };

/** Ouvre le canal, ou null si le navigateur ne le connaît pas (repli : rien). */
export function openAuthChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(AUTH_CHANNEL);
  } catch {
    return null;
  }
}

export function isAuthMessage(
  data: unknown,
  type: AuthChannelMessage["type"],
): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === type
  );
}
