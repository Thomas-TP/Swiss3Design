"use client";

import { useSyncExternalStore } from "react";
import { consentStatus, setConsent, subscribeConsent } from "@/lib/analytics";

// Donner ou retirer l'accord aux enregistrements de visite depuis la
// politique de confidentialité (le bandeau ne réapparaît pas après un
// choix). Libellés fournis par la page, qui porte le texte juridique.
export function RecordingConsent({
  labels,
}: {
  labels: {
    granted: string;
    notGranted: string;
    grant: string;
    revoke: string;
  };
}) {
  const status = useSyncExternalStore(
    subscribeConsent,
    consentStatus,
    () => "unavailable" as const,
  );
  if (status === "unavailable") return null;
  const granted = status === "granted";

  return (
    <span className="mt-3 flex flex-wrap items-center gap-3">
      <span className="font-medium">
        {granted ? labels.granted : labels.notGranted}
      </span>
      <button
        type="button"
        onClick={() => setConsent(!granted)}
        className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-ink"
      >
        {granted ? labels.revoke : labels.grant}
      </button>
    </span>
  );
}
