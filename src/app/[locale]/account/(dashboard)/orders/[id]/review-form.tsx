"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitReview, type ReviewState } from "../actions";
import { btnPrimarySm, field as fieldClass } from "../../_ui";

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
      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
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
        {/* oxlint-disable prefer-tag-over-role -- pattern ARIA radiogroup/radio standard (WAI-ARIA APG), etoile custom stylee, pas un <input type="radio"> natif pour garder le survol/preview */}
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
              strokeWidth={1.5}
              className={
                (hover || rating) >= n
                  ? "fill-accent text-accent-text"
                  : "text-swatch-ring"
              }
            />
          </button>
        ))}
        {/* oxlint-enable prefer-tag-over-role */}
      </div>
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        className={fieldClass}
      />
      {state.error && (
        <p className="text-sm font-medium text-accent-text">{t("error")}</p>
      )}
      <button
        type="submit"
        disabled={pending || rating === 0}
        className={btnPrimarySm}
      >
        {t("submit")}
      </button>
    </form>
  );
}
