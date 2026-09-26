"use client";

import { useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/analytics";

const SOURCES = ["google", "ai", "social", "friend", "other"] as const;
const noSubscription = () => () => {};

// « Comment avez-vous découvert Swiss3Design ? », une fois la commande payée.
// Beaucoup de visites envoyées par ChatGPT & co. arrivent sans référent et
// comptent en « direct » : seule la réponse de l'acheteur les révèle. Un
// clic, facultatif, envoyé comme événement anonyme (aucun consentement
// requis, rien de stocké hormis le fait d'avoir répondu dans cet onglet).
export function AttributionQuestion({ orderId }: { orderId: string }) {
  const t = useTranslations("attribution");
  const storageKey = `s3d-attribution:${orderId}`;
  // Déjà répondu dans cet onglet (rechargement) : lu après l'hydratation,
  // le serveur ne voit pas le stockage de session.
  const alreadyAnswered = useSyncExternalStore(
    noSubscription,
    () => {
      try {
        return !!sessionStorage.getItem(storageKey);
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [justAnswered, setAnswered] = useState(false);

  if (alreadyAnswered || justAnswered) {
    return (
      <p className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-soft">
        <Check size={16} className="text-emerald-600" />
        {t("thanks")}
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-6 text-center">
      <p className="text-sm font-semibold">{t("question")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => {
              track("Attribution Survey Answered", {
                source,
                order_id: orderId,
              });
              try {
                sessionStorage.setItem(storageKey, "1");
              } catch {
                /* Stockage bloqué : la question disparaît quand même. */
              }
              setAnswered(true);
            }}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-ink"
          >
            {t(source)}
          </button>
        ))}
      </div>
    </div>
  );
}
