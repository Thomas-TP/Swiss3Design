"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

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
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {t("error")}
        </p>
      )}
      <button
        type="button"
        onClick={() => answer(true)}
        disabled={pending !== null}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Check size={16} />
        {pending === "accept" ? t("processing") : t("allow")}
      </button>
      <button
        type="button"
        onClick={() => answer(false)}
        disabled={pending !== null}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
      >
        <X size={16} />
        {pending === "deny" ? t("processing") : t("deny")}
      </button>
    </div>
  );
}
