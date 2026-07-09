"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitReview, type ReviewState } from "../actions";

// Formulaire d'avis (une ligne de commande livrée). Sélecteur d'étoiles +
// commentaire. Server Action → état renvoyé (pas de redirect, golden rule).
export function ReviewForm({
  orderId,
  productId,
}: {
  orderId: string;
  productId: string;
}) {
  const t = useTranslations("reviews");
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    submitReview,
    {},
  );
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state.success) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        {t("thanks")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={t("ratingLabel")}
      >
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
            <Star
              size={22}
              className={
                (hover || rating) >= n ? "fill-accent text-accent" : "text-line"
              }
            />
          </button>
        ))}
      </div>
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder={t("placeholder")}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition-colors focus:border-soft/50"
      />
      {state.error && <p className="text-xs text-accent">{t("error")}</p>}
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
