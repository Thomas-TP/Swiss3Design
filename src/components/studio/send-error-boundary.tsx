"use client";

import { Component, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Frontière du formulaire du tiroir d'envoi (brief « Strates », §6.9, point 6 :
// « erreur de la Server Action → Réessayer »). Une Server Action qui ne répond
// pas (connexion coupée à la 3e étape) LÈVE une erreur dans `useActionState` :
// sans frontière, elle remonte jusqu'à error.tsx et remplace toute la page du
// Studio par « Erreur inattendue ». Ici, le tiroir reste ouvert, dit que
// l'envoi a échoué et propose « Réessayer » : le formulaire est remonté, et le
// fichier déjà envoyé n'est pas renvoyé (upload-cache.ts, même empreinte).

function SendFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("quote");
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <p className="text-sm font-medium text-accent-text">
        {t("errors.network")}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

export class SendErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Ni texte saisi ni adresse : l'erreur du réseau seule.
    console.error("[studio] envoi interrompu", error);
  }

  render() {
    return this.state.failed ? (
      <SendFailed onRetry={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}
