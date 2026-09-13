"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart, parseCart } from "@/lib/cart";
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
    <output className="mx-auto mt-4 max-w-6xl px-4 text-sm">{t(status)}</output>
  );
}
