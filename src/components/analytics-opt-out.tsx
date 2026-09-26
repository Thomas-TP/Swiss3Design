"use client";

import { useSyncExternalStore } from "react";
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
  subscribeAnalyticsOptOut,
} from "@/lib/analytics";

// Droit d'opposition à la mesure d'audience (art. 45c LTC : information +
// possibilité de refuser), proposé dans la politique de confidentialité. Le
// choix est gardé dans ce navigateur. Libellés fournis par la page, qui
// porte déjà le texte juridique dans les 4 langues.
export function AnalyticsOptOut({
  labels,
}: {
  labels: { active: string; inactive: string; disable: string; enable: string };
}) {
  // null côté serveur et à l'hydratation : le choix vit dans le navigateur.
  const optedOut = useSyncExternalStore(
    subscribeAnalyticsOptOut,
    isAnalyticsOptedOut,
    () => null,
  );
  if (optedOut === null) return null;

  return (
    <span className="mt-3 flex flex-wrap items-center gap-3">
      <span className="font-medium">
        {optedOut ? labels.inactive : labels.active}
      </span>
      <button
        type="button"
        onClick={() => setAnalyticsOptOut(!optedOut)}
        className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-ink"
      >
        {optedOut ? labels.enable : labels.disable}
      </button>
    </span>
  );
}
