// Les opérations à fort impact exigent une authentification récente. La date
// de création, et non updatedAt, mesure une vraie reconnexion : Better Auth
// rafraîchit régulièrement l'expiration d'une session sans redemander de secret.
export const SENSITIVE_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

export function isSessionFresh(
  createdAt: Date | string | number,
  nowMs = Date.now(),
  maxAgeMs = SENSITIVE_SESSION_MAX_AGE_MS,
): boolean {
  const createdAtMs = new Date(createdAt).getTime();
  return (
    Number.isFinite(createdAtMs) &&
    maxAgeMs >= 0 &&
    nowMs - createdAtMs <= maxAgeMs
  );
}
