// Événements de mesure du Studio (brief « Strates », §4.10) : contrats typés
// dans src/lib/analytics.ts (`TrackedEvents`). Règle commune, non négociable :
// AUCUN texte saisi (nom, fonction, contact, sommet) dans une propriété, et
// rien de la configuration au-delà d'un nom de contrôle.
//
// `Studio Configured` : premier réglage par objet et par session (la clé
// `control` est le nom court du réglage, `h`, `m`, `palette`…).
import { track } from "@/lib/analytics";
import type { StudioObjectId } from "@/lib/studio/types";

const SESSION_PREFIX = "s3d-tracked:Studio Configured:";
const done = new Set<StudioObjectId>();

export function trackConfigured(object: StudioObjectId, control: string) {
  if (done.has(object)) return;
  done.add(object);
  try {
    const key = `${SESSION_PREFIX}${object}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Stockage bloqué : une fois par chargement de page seulement.
  }
  track("Studio Configured", { object, control });
}
