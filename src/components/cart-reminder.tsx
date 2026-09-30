"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import {
  GuestEmailVerification,
  type EmailProof,
} from "./guest-email-verification";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";

// Opt-in nLPD de relance de panier : case décochée par défaut, consentement
// explicite. N'envoie l'e-mail + le panier qu'au clic du bouton (action
// délibérée). Affiché uniquement quand le panier n'est pas vide.
// Habillage « Strates » : encart à rayon `card`, bouton en contour (le rouge
// reste à « Commander », un seul par écran). Logique inchangée.
export function CartReminder() {
  const t = useTranslations("cartReminder");
  const locale = useLocale();
  const { items } = useCart();
  const { data: session } = useSession();
  const [proof, setProof] = useState<EmailProof | null>(null);
  const email = session?.user.emailVerified ? session.user.email : proof?.email;
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  if (items.length === 0) return null;

  if (status === "done") {
    return (
      <p className="mt-6 flex items-center gap-2 rounded-field bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <Check size={16} strokeWidth={1.5} className="shrink-0" />
        {t("done")}
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent || !email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/cart-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          emailProof: proof?.token,
          consent: true,
          items,
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-card border border-line bg-paper p-4"
    >
      <p className="text-sm font-semibold text-ink">{t("title")}</p>
      {session?.user.emailVerified ? (
        <p className="ph-mask mt-2 break-all text-sm">{email}</p>
      ) : (
        <GuestEmailVerification
          proof={proof}
          onProof={setProof}
          notice={t("verifyNotice")}
          next="/cart"
        />
      )}
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
        />
        <span>{t("consent")}</span>
      </label>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        full
        disabled={!consent || !email || status === "sending"}
        className="mt-4"
      >
        {status === "sending" ? "…" : t("cta")}
      </Button>
      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-accent-text">
          {t("error")}
        </p>
      )}
    </form>
  );
}
