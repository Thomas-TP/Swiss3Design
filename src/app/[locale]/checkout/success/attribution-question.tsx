"use client";

import { useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/analytics";
import { chipClass } from "@/components/ui/chip";

const SOURCES = ["google", "ai", "social", "friend", "other"] as const;
const noSubscription = () => () => {};

// « Comment avez-vous découvert Swiss3Design ? », une fois la commande payée.
// Beaucoup de visites envoyées par ChatGPT & co. arrivent sans référent et
// comptent en « direct » : seule la réponse de l'acheteur les révèle. Un
// clic, facultatif, envoyé comme événement anonyme (aucun consentement
// requis, rien de stocké hormis le fait d'avoir répondu dans cet onglet).
// Habillage « Strates » : puces du système (chipClass), carte `card`, texte
// aligné à gauche comme le reste de la page de confirmation.
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
      <output className="mt-6 flex items-center gap-2 text-sm font-medium text-soft">
        <Check
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-emerald-700 dark:text-emerald-300"
        />
        {t("thanks")}
      </output>
    );
  }

  return (
    <section className="mt-6 rounded-card border border-line bg-surface p-6">
      <p className="text-sm font-semibold text-ink">{t("question")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
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
            className={chipClass(false, "min-h-11")}
          >
            {t(source)}
          </button>
        ))}
      </div>
    </section>
  );
}
