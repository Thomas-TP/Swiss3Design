// Contrôleurs des vues (brief « Strates », §4.1, §4.5) : les chorégraphies
// (src/motion/choreo/**, chargées par leurs propres gates) retrouvent ici
// l'objet animable qu'expose la scène d'une vue, par l'id de la vue (useId du
// composant StageView, lu dans le DOM ou le pont). Le Stage publie le
// contrôleur une fois la scène montée et le retire à sa libération ; une
// chorégraphie montée avant la scène attend avec onController.

const controllers = new Map<string, unknown>();
const waiting = new Map<string, Set<(c: unknown) => void>>();

export function getController<C>(viewId: string): C | undefined {
  return controllers.get(viewId) as C | undefined;
}

/**
 * Appelle `cb` dès que le contrôleur de la vue existe (tout de suite s'il
 * existe déjà), puis à chaque nouveau contrôleur (scène remontée après une
 * perte de contexte, par exemple). Renvoie le désabonnement.
 */
export function onController<C>(
  viewId: string,
  cb: (c: C) => void,
): () => void {
  const listener = cb as (c: unknown) => void;
  let set = waiting.get(viewId);
  if (!set) {
    set = new Set();
    waiting.set(viewId, set);
  }
  set.add(listener);
  const current = controllers.get(viewId);
  if (current !== undefined) listener(current);
  return () => {
    const listeners = waiting.get(viewId);
    listeners?.delete(listener);
    if (listeners?.size === 0) waiting.delete(viewId);
  };
}

/** Réservé au Stage. */
export function publishController(viewId: string, controller: unknown) {
  if (controller === undefined) return;
  controllers.set(viewId, controller);
  for (const listener of Array.from(waiting.get(viewId) ?? []))
    listener(controller);
}

/** Réservé au Stage. */
export function withdrawController(viewId: string) {
  controllers.delete(viewId);
}
