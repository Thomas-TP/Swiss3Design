"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCart, type CartItem } from "@/lib/cart";
import { fetchCartLine, parseItemParam } from "@/lib/agent/cart-line";

// Liens panier générés pour les agents (outil build_cart_link) :
// /fr/cart?item=vase-spirale|1||Rouge&item=… remplit le panier puis retire
// les paramètres de l'URL. Chaque ligne est revalidée via l'API publique ;
// une ligne invalide n'empêche pas d'ajouter les autres. Le résultat
// s'affiche dans la même note de statut que la relance de panier.
export function CartLinkImport() {
  const { restore } = useCart();
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  }, [restore]);
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle");
  const locale = useLocale();
  const t = useTranslations("cartLink");

  useEffect(() => {
    const requests = new URLSearchParams(location.search)
      .getAll("item")
      .map(parseItemParam)
      .filter((r) => r !== null)
      .slice(0, 20);
    if (requests.length === 0 || started.current) return;
    started.current = true;
    history.replaceState(history.state, "", location.pathname);
    void Promise.allSettled(requests.map((r) => fetchCartLine(r, locale))).then(
      (results) => {
        const lines = results
          .filter(
            (r): r is PromiseFulfilledResult<CartItem> =>
              r.status === "fulfilled",
          )
          .map((r) => r.value);
        if (lines.length > 0) restoreRef.current(lines);
        setStatus(lines.length === requests.length ? "added" : "error");
      },
    );
  }, [locale]);

  return status === "idle" ? null : (
    <div className="s3d-page pt-4">
      <output className="block rounded-field border border-line border-l-accent bg-surface px-4 py-3 text-sm text-ink border-l-3">
        {t(status)}
      </output>
    </div>
  );
}
