"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/lib/cart";

// Opt-in nLPD de relance de panier : case décochée par défaut, consentement
// explicite. N'envoie l'e-mail + le panier qu'au clic du bouton (action
// délibérée). Affiché uniquement quand le panier n'est pas vide.
export function CartReminder() {
  const t = useTranslations("cartReminder");
  const locale = useLocale();
  const { items } = useCart();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  if (items.length === 0) return null;

  if (status === "done") {
    return (
      <p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <Check size={15} className="shrink-0" />
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
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            priceCents: i.priceCents,
          })),
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
      className="mt-5 rounded-xl border border-line bg-paper p-4"
    >
      <p className="text-xs font-semibold">{t("title")}</p>
      <input
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-soft/50"
      />
      <label className="mt-2 flex items-start gap-2 text-xs text-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        <span>{t("consent")}</span>
      </label>
      <button
        type="submit"
        disabled={!consent || !email || status === "sending"}
        className="mt-3 w-full rounded-full border border-line py-2 text-xs font-semibold text-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
      >
        {status === "sending" ? "…" : t("cta")}
      </button>
      {status === "error" && (
        <p className="mt-2 text-xs text-accent">{t("error")}</p>
      )}
    </form>
  );
}
