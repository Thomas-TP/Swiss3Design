"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Émet un événement de mesure d'audience au montage, depuis une page serveur
// (fiche produit vue, commande confirmée…). `onceKey` dédoublonne sur la
// session de l'onglet : recharger la confirmation ne recompte pas la vente.
export function TrackEvent({
  event,
  properties,
  onceKey,
}: {
  event: string;
  properties?: Record<string, unknown>;
  onceKey?: string;
}) {
  // Sérialisé pour une dépendance stable : l'objet est recréé à chaque rendu.
  const payload = JSON.stringify(properties ?? {});
  useEffect(() => {
    if (onceKey) {
      const key = `s3d-tracked:${event}:${onceKey}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        /* Stockage bloqué : l'événement part, sans dédoublonnage. */
      }
    }
    track(event, JSON.parse(payload));
  }, [event, onceKey, payload]);
  return null;
}
