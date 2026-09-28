// Préférence de mouvement (brief « Strates », §3.6). Source de vérité :
// l'attribut data-motion="reduce" | "full" de <html>, posé AVANT le paint par
// le script anti-FOUC du layout (choix mémorisé, sinon réglage du système).
// Ce module le relit, le tient à jour quand le système change d'avis sans
// choix explicite du visiteur, et porte l'écriture de l'interrupteur
// « Réduire les animations » du footer (MotionToggle).

export type MotionPreference = "reduce" | "full";

/** localStorage : choix explicite du visiteur (absent = suivre le système). */
export const MOTION_STORAGE_KEY = "s3d-motion";
/** Événement émis sur window à chaque changement (interrupteur, système, autre onglet). */
export const MOTION_CHANGE_EVENT = "s3d-motion-change";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function storedPreference(): MotionPreference | null {
  try {
    const value = localStorage.getItem(MOTION_STORAGE_KEY);
    return value === "reduce" || value === "full" ? value : null;
  } catch {
    return null; // stockage bloqué : on suit le système
  }
}

function systemPrefersReduced(): boolean {
  try {
    return window.matchMedia(REDUCED_QUERY).matches;
  } catch {
    return false;
  }
}

/** Préférence effective : choix mémorisé, sinon réglage du système. */
export function resolveMotionPreference(): MotionPreference {
  const stored = storedPreference();
  if (stored) return stored;
  return systemPrefersReduced() ? "reduce" : "full";
}

/** true si le mouvement doit être réduit. Serveur : false (le SSR n'anime rien). */
export function readReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.dataset.motion;
  if (attr === "reduce" || attr === "full") return attr === "reduce";
  return resolveMotionPreference() === "reduce";
}

function apply(pref: MotionPreference) {
  const root = document.documentElement;
  if (root.dataset.motion === pref) return false;
  root.dataset.motion = pref;
  return true;
}

/**
 * Interrupteur du footer : "reduce" ou "full" mémorise un choix explicite,
 * null l'efface (retour au réglage du système). Pose data-motion sans
 * rechargement et prévient les abonnés (runtime, Stage, composants).
 */
export function setMotionPreference(pref: MotionPreference | null) {
  try {
    if (pref) localStorage.setItem(MOTION_STORAGE_KEY, pref);
    else localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {
    // Stockage bloqué : le choix vaut pour la page en cours.
  }
  apply(pref ?? resolveMotionPreference());
  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}

/**
 * S'abonne aux changements de préférence. Le réglage du système et le choix
 * fait dans un autre onglet sont réappliqués sur <html> ici même : sans cela,
 * data-motion resterait figé à la valeur du chargement de la page.
 */
export function subscribeMotionPreference(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const resync = () => {
    if (apply(resolveMotionPreference()))
      window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MOTION_STORAGE_KEY) resync();
  };
  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia(REDUCED_QUERY);
  } catch {
    media = null;
  }
  window.addEventListener(MOTION_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media?.addEventListener("change", resync);
  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media?.removeEventListener("change", resync);
  };
}
