"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { medusa } from "@/lib/medusa";
import { useAccountUser } from "../../account-context";

// Formulaire d'avis (une ligne de commande livrée). L'éligibilité (commande
// livrée + produit présent) est vérifiée côté Medusa (POST /store/reviews) ;
// un doublon (avis déjà déposé pour cette commande/produit) renvoie 409,
// affiché comme "déjà noté" plutôt que pré-détecté côté client — la lecture
// publique (/store/reviews) ne renvoie que les avis déjà publiés, donc un
// avis "pending" du client ne serait de toute façon pas détectable à l'avance.
export function ReviewForm({ orderId, productId }: { orderId: string; productId: string }) {
  const t = useTranslations("reviews");
  const user = useAccountUser();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<"idle" | "success" | "already" | "error">("idle");

  if (state === "success") {
    return <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("thanks")}</p>;
  }
  if (state === "already") {
    return <p className="text-sm text-soft">{t("alreadyReviewed")}</p>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating === 0 || pending) return;
    setPending(true);
    try {
      await medusa.client.fetch("/store/reviews", {
        method: "POST",
        body: { order_id: orderId, product_id: productId, rating, body: body || undefined, author_name: user.name },
      });
      setState("success");
    } catch (err) {
      setState((err as { status?: number })?.status === 409 ? "already" : "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-center gap-1" role="radiogroup" aria-label={t("ratingLabel")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={String(n)}
            aria-checked={rating === n}
            role="radio"
            className="p-0.5"
          >
            <Star size={22} className={(hover || rating) >= n ? "fill-accent text-accent" : "text-line"} />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={t("placeholder")}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition-colors focus:border-soft/50"
      />
      {state === "error" && <p className="text-xs text-accent">{t("error")}</p>}
      <button
        type="submit"
        disabled={pending || rating === 0}
        className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper transition-opacity disabled:opacity-50"
      >
        {t("submit")}
      </button>
    </form>
  );
}
