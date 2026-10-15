"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isStudioLine, useCart, type StudioCartItem } from "@/lib/cart";
import {
  cartProperties,
  productProperties,
  studioProductProperties,
  track,
} from "@/lib/analytics";
import { cfImage } from "@/lib/cf-image";
import { formatChf } from "@/lib/format";
import { shippingForOrder } from "@/lib/shipping";
import { shortColors } from "@/lib/filament/capacity";
import { CartReminder } from "@/components/cart-reminder";
import { PageHeader } from "@/components/page-header";
import { useFilamentCapacity } from "@/components/use-filament-capacity";
import { Button, ButtonLink } from "@/components/ui/button";
import { withDot } from "@/components/ui/dot-title";
import { StrataIcon } from "@/components/ui/icons";

// Panier (brief « Strates » §7.13). Hors groupe (site) : ni Lenis ni Stage ;
// le mouvement se limite à la barre de livraison offerte (transition CSS, coupée
// en mouvement réduit par globals.css). Mise en page sobre : une carte par
// ligne, jamais de grille de filets (§2.3). Un seul bouton rouge : « Commander ».
// La logique (panier local, port, « Cart Viewed », « Product Removed ») est
// celle d'avant la refonte.

// Les lignes du Studio (poster, résumé, moteur de statistiques) se chargent à la
// demande : un panier de produits seuls ne paie rien de plus.
const StudioLine = dynamic(() => import("./studio-line"), {
  ssr: false,
  loading: () => (
    <li
      className="h-28 rounded-card border border-line bg-surface"
      aria-hidden="true"
    />
  ),
});

export default function CartContent({
  shippingSettings,
}: {
  shippingSettings: { shippingCents: number; freeOverCents: number };
}) {
  const t = useTranslations("cart");
  const ts = useTranslations("system.cart");
  const tShell = useTranslations("shell.cta");
  const locale = useLocale();
  const {
    lines,
    count,
    subtotalCents,
    shopSubtotalCents,
    setQuantity,
    remove,
    setStudioQuantity,
    removeStudio,
  } = useCart();

  // « Cart Viewed » une fois, dès que le panier relu du stockage local est
  // non vide (il est vide au premier rendu, avant l'hydratation).
  const viewTracked = useRef(false);
  useEffect(() => {
    if (viewTracked.current || lines.length === 0) return;
    viewTracked.current = true;
    track("Cart Viewed", cartProperties(lines));
  }, [lines]);

  // Stock de filament des objets du Studio : chaque ligne remonte ses grammes par
  // couleur (pièce × quantité) ; la somme de toutes les lignes est comparée à la
  // capacité publique. Une couleur épuisée est signalée sur sa ligne et bloque
  // « Commander » (le paiement la refuserait : 409 out_of_stock). Sans objet du
  // Studio, aucune requête ; capacité inconnue ou hors ligne : rien n'est bloqué.
  const studioIds = lines.filter(isStudioLine).map((line) => line.id);
  const capacity = useFilamentCapacity(studioIds.length > 0);
  const [needs, setNeeds] = useState<
    Record<string, Readonly<Record<string, number | undefined>>>
  >({});
  const onNeeds = useCallback(
    (id: string, grams: Readonly<Record<string, number | undefined>>) =>
      setNeeds((prev) =>
        JSON.stringify(prev[id]) === JSON.stringify(grams)
          ? prev
          : { ...prev, [id]: grams },
      ),
    [],
  );
  const studioKey = studioIds.join("|");
  const short = useMemo(
    () =>
      shortColors(
        capacity,
        studioKey.split("|").flatMap((id) => (needs[id] ? [needs[id]] : [])),
      ),
    [capacity, needs, studioKey],
  );

  // Le port ne dépend que de la part boutique : le prix d'un objet du Studio est
  // ferme, livraison comprise.
  const shippingCents = shippingForOrder(
    {
      shopCents: shopSubtotalCents,
      studioCents: subtotalCents - shopSubtotalCents,
    },
    shippingSettings,
  );
  const totalCents = subtotalCents + shippingCents;
  const remainingForFree = shippingSettings.freeOverCents - shopSubtotalCents;
  // Livraison offerte partout (port à 0) : plus de seuil, donc plus de barre ni de
  // « Plus que X pour la livraison offerte ». Sinon : part du seuil atteinte (0–100).
  // Un panier du Studio seul n'a jamais de port : pas de seuil à atteindre non plus.
  const freeForAll =
    shippingSettings.shippingCents === 0 || shopSubtotalCents === 0;
  const progress =
    shippingSettings.freeOverCents > 0
      ? Math.min(
          100,
          Math.round(
            (shopSubtotalCents / shippingSettings.freeOverCents) * 100,
          ),
        )
      : 100;

  if (lines.length === 0) {
    return (
      <div className="s3d-page py-16 md:py-24">
        <p className="s3d-label text-soft">{ts("emptyKicker")}</p>
        <h1 className="mt-3 font-display text-display break-words text-ink">
          {withDot(ts("emptyTitle"))}
        </h1>
        <p className="mt-5 max-w-xl text-lead text-soft">{ts("emptyText")}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <ButtonLink href="/studio" variant="primary" size="lg">
            <StrataIcon size={20} />
            {tShell("studio")}
          </ButtonLink>
          <ButtonLink href="/shop" variant="secondary" size="lg">
            {tShell("shop")}
          </ButtonLink>
          <ButtonLink href="/custom" variant="text" size="lg">
            {tShell("file")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="s3d-page py-10 md:py-16">
      <PageHeader eyebrow={ts("count", { count })} title={ts("title")} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <ul className="space-y-3">
          {lines.map((line) => {
            if (isStudioLine(line)) {
              return (
                <StudioLine
                  key={`studio:${line.id}`}
                  item={line}
                  onQuantity={setStudioQuantity}
                  onNeeds={onNeeds}
                  shortColors={short}
                  onRemove={(removed: StudioCartItem) => {
                    removeStudio(removed.id);
                    track("Product Removed", studioProductProperties(removed));
                  }}
                />
              );
            }
            const item = line;
            const image = cfImage(item.imageUrl, { width: 200 });
            return (
              <li
                key={`${item.productId}:${item.variantId ?? ""}:${item.colorName ?? ""}`}
                className="flex gap-4 rounded-card border border-line bg-surface p-3 sm:p-4"
              >
                {/* Vignette décorative : le lien du nom suffit au clavier. */}
                <Link
                  href={`/products/${item.slug}`}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="block h-20 w-20 shrink-0 overflow-hidden rounded-field bg-paper sm:h-24 sm:w-24"
                >
                  {image && (
                    <img
                      src={image}
                      alt=""
                      width={96}
                      height={96}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${item.slug}`}
                        className="break-words font-semibold leading-snug text-ink underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                      {(item.variantName || item.colorName) && (
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-soft">
                          {item.variantName && <span>{item.variantName}</span>}
                          {item.colorName && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                aria-hidden="true"
                                className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring"
                                style={{
                                  backgroundColor: item.colorHex ?? undefined,
                                }}
                              />
                              {item.colorName}
                            </span>
                          )}
                        </p>
                      )}
                      <p className="s3d-num mt-1 text-sm text-soft">
                        {ts("unitPrice", {
                          price: formatChf(item.priceCents, locale),
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        remove(
                          item.productId,
                          item.variantId ?? null,
                          item.colorName ?? null,
                        );
                        track("Product Removed", productProperties(item));
                      }}
                      aria-label={t("remove")}
                      className="-mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-soft transition-colors hover:bg-line/60 hover:text-accent-text"
                    >
                      <Trash2 size={18} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="inline-flex items-center rounded-field border border-line bg-elevated">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(
                            item.productId,
                            item.variantId ?? null,
                            item.colorName ?? null,
                            item.quantity - 1,
                          )
                        }
                        aria-label={t("decrease")}
                        className="grid h-10 w-10 place-items-center rounded-l-field transition-colors hover:bg-line/60"
                      >
                        <Minus size={16} strokeWidth={1.5} />
                      </button>
                      <output
                        aria-label={t("quantity")}
                        className="s3d-num min-w-8 text-center text-sm font-semibold"
                      >
                        {item.quantity}
                      </output>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(
                            item.productId,
                            item.variantId ?? null,
                            item.colorName ?? null,
                            item.quantity + 1,
                          )
                        }
                        aria-label={t("increase")}
                        className="grid h-10 w-10 place-items-center rounded-r-field transition-colors hover:bg-line/60"
                      >
                        <Plus size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="s3d-num font-semibold text-ink">
                      {formatChf(item.priceCents * item.quantity, locale)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="rounded-card border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="s3d-label text-soft">{ts("summary")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-soft">{t("subtotal")}</dt>
              <dd className="s3d-num font-medium">
                {formatChf(subtotalCents, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-soft">{t("shipping")}</dt>
              <dd className="s3d-num font-medium">
                {shippingCents === 0
                  ? t("shippingFree")
                  : formatChf(shippingCents, locale)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <dt className="font-semibold text-ink">{t("total")}</dt>
              <dd className="s3d-num text-xl font-bold text-ink">
                {formatChf(totalCents, locale)}
              </dd>
            </div>
          </dl>

          {freeForAll ? (
            // Livraison offerte partout en Suisse : plus de seuil, plus de barre.
            <p className="mt-6 text-sm text-soft">{ts("freeAll")}</p>
          ) : (
            // Progression vers la livraison offerte : un filet rouge dont la tête est
            // un point, la buse (brief §7.13). Décoratif : la phrase dessous porte
            // l'information. Seule la part boutique compte.
            <div className="mt-6">
              <div aria-hidden="true" className="relative h-0.5 bg-line">
                <div
                  className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-[var(--dur-reveal)] ease-strate"
                  style={{ width: `${progress}%` }}
                />
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-[var(--dur-reveal)] ease-strate"
                  style={{ left: `calc(${progress}% - 5px)` }}
                />
              </div>
              <p className="mt-3 text-sm text-soft">
                {remainingForFree > 0
                  ? ts("freeHint", {
                      amount: formatChf(remainingForFree, locale),
                    })
                  : ts("freeReached")}
              </p>
            </div>
          )}

          {short.size > 0 ? (
            <>
              <output className="mt-6 block text-sm text-accent-text">
                {ts("shortBlock")}
              </output>
              <Button
                variant="primary"
                size="lg"
                full
                disabled
                className="mt-3"
              >
                {ts("checkout")}
                <ArrowRight size={18} strokeWidth={1.5} />
              </Button>
            </>
          ) : (
            <ButtonLink
              href="/checkout"
              variant="primary"
              size="lg"
              full
              className="mt-6"
            >
              {ts("checkout")}
              <ArrowRight size={18} strokeWidth={1.5} />
            </ButtonLink>
          )}

          <CartReminder />
        </aside>
      </div>
    </div>
  );
}
