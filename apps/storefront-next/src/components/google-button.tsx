"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signInWithGooglePopup } from "@/lib/auth-client";
import { SOCIAL_ICONS, SOCIAL_LABELS } from "./social-icons";

// Connexion Google via popup (voir auth-client.ts::signInWithGooglePopup) —
// seul provider social supporté par ce storefront. onSuccess est appelé une
// fois le jeton capturé (session déjà rafraîchie côté hook useSession()) ;
// à la page appelante de naviguer ensuite (router.push), comme pour les
// autres méthodes de connexion.
export function GoogleButton({ onSuccess, next }: { onSuccess: () => void; next?: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    setPending(true);
    setError(false);
    const { error: err } = await signInWithGooglePopup(next ? { callbackURL: next } : undefined);
    setPending(false);
    if (err) {
      // Popup fermée/bloquée par l'utilisateur : pas une vraie erreur à afficher
      if (err !== "popup_closed" && err !== "popup_blocked") setError(true);
      return;
    }
    onSuccess();
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:border-ink disabled:opacity-60"
      >
        {SOCIAL_ICONS.google}
        {pending ? t("processing") : SOCIAL_LABELS.google}
      </button>
      {error && <p className="mt-2 text-center text-xs font-medium text-accent">{t("errorGeneric")}</p>}
    </div>
  );
}
