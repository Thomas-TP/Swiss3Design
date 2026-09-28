"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

// Message éphémère (brief « Strates », §6.7 « Lien copié : le texte n'est pas
// inclus », favoris). Contrôlé par son hôte (useToast) : chaque écran monte le
// sien, pas de fournisseur global à câbler dans le layout. La région <output>
// (rôle status, annonce polie) est TOUJOURS rendue, vide au repos : un lecteur
// d'écran n'annonce que ce qui change dans une région déjà présente. Au-dessus
// de la BottomNav (calque 50) en mobile, en bas à droite dès lg ; entrée par
// @starting-style, sans animation de sortie.
const DEFAULT_DURATION_MS = 4000;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((text: string) => setMessage(text), []);
  const dismiss = useCallback(() => setMessage(null), []);
  return { message, show, dismiss };
}

export function Toast({
  message,
  onDismiss,
  duration = DEFAULT_DURATION_MS,
}: {
  message: string | null;
  onDismiss: () => void;
  /** 0 : reste affiché jusqu'au clic sur « Masquer le message ». */
  duration?: number;
}) {
  const t = useTranslations("shell.ui");

  useEffect(() => {
    if (!message || duration <= 0) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <output className="pointer-events-none fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[55] flex justify-center lg:inset-x-auto lg:bottom-6 lg:right-6">
      {message ? (
        <span className="pointer-events-auto flex max-w-md items-center gap-3 rounded-card bg-ink py-2.5 pl-4 pr-2 text-sm text-paper shadow-lg shadow-ink/20 transition-[opacity,translate] duration-280 ease-strate starting:translate-y-2 starting:opacity-0">
          <span>{message}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("dismiss")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-field text-paper/70 transition-colors hover:text-paper"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </span>
      ) : null}
    </output>
  );
}
