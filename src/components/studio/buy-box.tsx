"use client";

import { memo } from "react";
import { Minus, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { SiteLink } from "@/components/ui/site-link";
import { formatChf } from "@/lib/format";
import { STUDIO_QTY_MAX } from "@/lib/studio/price";
import type { Translate } from "./summary";

// Bloc d'achat du Studio (décision du 14.10.2026 : achat direct, panier puis
// paiement, comme un produit de la boutique) : le prix ferme à la quantité
// choisie, « Livraison offerte », le bouton « Ajouter au panier » et, en lien
// secondaire, la demande particulière (devis : plus de 20 pièces ou demande
// spéciale). Le prix n'est pas calculé ici : StudioApp le passe (`price.ts`, la
// même fonction que le serveur refait au paiement).
//
// Sans JavaScript, rien à ajouter au panier : le lien du formulaire de devis.
// Mobile : le bouton principal est dans la barre d'action fixe du bas
// (StudioApp) ; ce bloc garde le prix, la quantité et le lien de devis.

export interface BuyBoxProps {
  t: Translate;
  locale: string;
  /** Prix unitaire ferme à `quantity` (centimes entiers). */
  unitCents: number;
  quantity: number;
  onQuantity: (quantity: number) => void;
  blocked: boolean;
  /** Pourquoi l'ajout est bloqué (texte déjà rédigé), ou null. */
  reason: string | null;
  reasonId: string;
  onAdd: () => void;
  /** Ouvre le tiroir de la demande particulière (devis). */
  onQuote: () => void;
  /** La ligne du panier en cours de modification, ou null. */
  editing: boolean;
  onCancelEdit: () => void;
  /** Dernier geste réussi : la ligne a été ajoutée ou mise à jour. */
  done: "added" | "updated" | null;
}

function BuyBoxView({
  t,
  locale,
  unitCents,
  quantity,
  onQuantity,
  blocked,
  reason,
  reasonId,
  onAdd,
  onQuote,
  editing,
  onCancelEdit,
  done,
}: BuyBoxProps) {
  const total = unitCents * quantity;
  const step = (delta: number) =>
    onQuantity(Math.min(STUDIO_QTY_MAX, Math.max(1, quantity + delta)));
  return (
    <div className="flex flex-col items-start gap-3">
      {/* Sans JavaScript : le lien du devis, seule suite possible. */}
      <ButtonLink
        href="/custom#demande"
        variant="primary"
        size="lg"
        className="group-data-[js]/studio:hidden"
      >
        {t("send.noscript")}
      </ButtonLink>

      <div className="hidden w-full flex-col gap-3 group-data-[js]/studio:flex">
        <div>
          <p className="s3d-num text-2xl font-semibold text-ink">
            {formatChf(total, locale)}
          </p>
          <p className="mt-0.5 text-sm text-soft">
            {quantity > 1
              ? `${t("buy.unit", { price: formatChf(unitCents, locale) })} · `
              : ""}
            {t("buy.freeShipping")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex items-center rounded-field border border-line bg-elevated">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={quantity <= 1}
              aria-label={t("buy.decrease")}
              className="grid h-11 w-11 place-items-center rounded-l-field transition-colors hover:bg-line/60 disabled:opacity-40"
            >
              <Minus size={16} strokeWidth={1.5} />
            </button>
            <output
              aria-label={t("buy.quantity")}
              className="s3d-num min-w-9 text-center text-sm font-semibold"
            >
              {quantity}
            </output>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={quantity >= STUDIO_QTY_MAX}
              aria-label={t("buy.increase")}
              className="grid h-11 w-11 place-items-center rounded-r-field transition-colors hover:bg-line/60 disabled:opacity-40"
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          </div>
          {/* Bureau : le bouton principal est ici ; mobile : dans la barre du bas. */}
          <div className="max-lg:hidden">
            <Button
              variant="primary"
              size="lg"
              disabled={blocked}
              onClick={onAdd}
              aria-describedby={reason ? reasonId : undefined}
            >
              {editing ? t("buy.update") : t("buy.cta")}
            </Button>
          </div>
        </div>

        {reason ? (
          <p
            id={reasonId}
            className="max-w-[46ch] text-sm font-medium text-accent-text"
          >
            {reason}
          </p>
        ) : null}

        <output className="block min-h-5 text-sm font-medium text-ink">
          {done ? (
            <>
              {done === "updated" ? t("buy.updated") : t("buy.added")}{" "}
              <SiteLink
                href="/cart"
                className="underline decoration-line underline-offset-4 hover:decoration-ink"
              >
                {t("buy.viewCart")}
              </SiteLink>
            </>
          ) : null}
        </output>

        {editing ? (
          <p className="max-w-[52ch] text-sm text-soft">
            {t("buy.editing")}{" "}
            <button
              type="button"
              onClick={onCancelEdit}
              className="underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              {t("buy.cancelEdit")}
            </button>
          </p>
        ) : null}

        <p className="max-w-[52ch] text-sm text-soft">
          {t("buy.firm")} {t("buy.quoteLead")}{" "}
          <button
            type="button"
            onClick={onQuote}
            className="text-ink underline decoration-line decoration-1 underline-offset-4 hover:decoration-ink"
          >
            {t("buy.quoteLink")}
          </button>
          <span className="block">
            {t("buy.quoteHint", { max: STUDIO_QTY_MAX })}
          </span>
        </p>
      </div>
    </div>
  );
}

export const BuyBox = memo(BuyBoxView);
