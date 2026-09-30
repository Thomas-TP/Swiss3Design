"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart, parseCart } from "@/lib/cart";

// Restauration d'un panier depuis le lien d'un e-mail de relance
// (#restore=<jeton>). Le jeton reste dans le fragment et n'en sort qu'en
// POST ; le résultat s'affiche dans une note de statut sobre (le point rouge
// de la note « état courant » : le rouge dit la chaleur, pas le décor).
export function CartRecovery() {
  const { restore } = useCart();
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  }, [restore]);
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "restored" | "restoreError">(
    "idle",
  );
  const t = useTranslations("cartReminder");
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("restore");
    if (!token || started.current) return;
    started.current = true;
    // Le jeton reste dans le fragment : jamais dans les logs HTTP ni le référent.
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
    void fetch("/api/cart-reminder/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("expired");
        const data = (await response.json()) as { items?: unknown };
        const items = parseCart(JSON.stringify(data.items));
        if (!items.length) throw new Error("empty");
        restoreRef.current(items);
        setStatus("restored");
      })
      .catch(() => setStatus("restoreError"));
  }, []);
  return status === "idle" ? null : (
    <div className="s3d-page pt-4">
      <output className="block rounded-field border border-line border-l-accent bg-surface px-4 py-3 text-sm text-ink border-l-3">
        {t(status)}
      </output>
    </div>
  );
}
