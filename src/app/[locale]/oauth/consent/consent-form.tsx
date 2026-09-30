"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import {
  alertError,
  btnAccentLg,
  btnGhost,
} from "../../account/(dashboard)/_ui";

// Réponse au consentement : POST /api/auth/oauth2/consent avec la requête
// signée de l'URL (jointe par le plugin client oauth-provider). better-auth
// renvoie { redirect, url } — vers l'application avec le code, ou avec
// error=access_denied — et son client suit l'URL lui-même.
export function ConsentForm() {
  const t = useTranslations("agentAccess.consent");
  const [pending, setPending] = useState<"accept" | "deny" | null>(null);
  const [failed, setFailed] = useState(false);

  async function answer(accept: boolean) {
    setPending(accept ? "accept" : "deny");
    setFailed(false);
    const { data, error } = await authClient.oauth2.consent({ accept });
    if (error) {
      setFailed(true);
      setPending(null);
      return;
    }
    const result = data as {
      redirect?: boolean;
      url?: string;
      redirect_uri?: string;
    } | null;
    // Repli si la réponse ne porte que redirect_uri (sans redirect: true).
    if (!result?.redirect && (result?.url ?? result?.redirect_uri))
      window.location.href = (result.url ?? result.redirect_uri)!;
  }

  return (
    <div className="space-y-3">
      {failed && (
        <p role="alert" className={alertError}>
          {t("error")}
        </p>
      )}
      <button
        type="button"
        onClick={() => answer(true)}
        disabled={pending !== null}
        className={btnAccentLg}
      >
        <Check size={16} strokeWidth={1.5} />
        {pending === "accept" ? t("processing") : t("allow")}
      </button>
      <button
        type="button"
        onClick={() => answer(false)}
        disabled={pending !== null}
        className={`${btnGhost} w-full`}
      >
        <X size={16} strokeWidth={1.5} />
        {pending === "deny" ? t("processing") : t("deny")}
      </button>
    </div>
  );
}
