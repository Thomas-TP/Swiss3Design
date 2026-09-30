"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { creationHash, useFavorites } from "@/lib/favorites";
import { useCart } from "@/lib/cart";
import { formatChf } from "@/lib/format";
import {
  listCreations,
  removeCreation,
  subscribeCreations,
  type Creation,
} from "@/lib/studio/creations";
import { writeStudioTexts } from "@/lib/studio/texts-store";
import { AddToCartMini } from "@/components/add-to-cart";
import { FavoriteButton } from "@/components/favorite-button";
import { PageHeader } from "@/components/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChipRadio } from "@/components/ui/chip";
import { StrataIcon } from "@/components/ui/icons";
import { Toast, useToast } from "@/components/ui/toast";

// Favoris (brief « Strates » §7.17) : deux onglets, « Objets » (les produits
// de la boutique, localStorage `s3d-favorites-v1`) et « Mes créations » (les
// configurations gardées au Studio, `s3d-creations-v1`). Hors groupe (site) :
// ni Lenis ni canvas. Tout reste dans ce navigateur : rien n'est envoyé, rien
// dans l'URL. Les onglets sont des radios natives (puces du système) : flèches,
// annonce « 2 sur 2 » et focus gérés par le navigateur.

type View = "objects" | "creations";

// Instantané serveur stable (hydratation) : la liste réelle n'arrive qu'après,
// useSyncExternalStore relançant alors le rendu avec le stockage.
const NO_CREATIONS: Creation[] = [];

export function FavoritesList() {
  const t = useTranslations("favorites");
  const ts = useTranslations("system.favorites");
  const tCta = useTranslations("shell.cta");
  const locale = useLocale();
  const { items, ready } = useFavorites();
  const { add } = useCart();
  const creations = useSyncExternalStore(
    subscribeCreations,
    listCreations,
    () => NO_CREATIONS,
  );
  const toast = useToast();
  const [view, setView] = useState<View>("objects");
  const [addedAll, setAddedAll] = useState(false);

  // Ajoute tous les favoris au panier d'un coup. add() fusionne les lignes
  // identiques, donc relancer ne crée pas de doublons (incrémente la quantité).
  // On conserve la liste des favoris : « ajouter » n'est pas « retirer ».
  function addAllToCart() {
    items.forEach((item) => {
      add(item);
    });
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 1800);
  }

  // Les plus récentes d'abord (le stockage les garde de la plus ancienne à la
  // plus récente).
  const shownCreations = [...creations].reverse();

  return (
    <div className="s3d-page py-10 md:py-16">
      <PageHeader
        title={ts("title")}
        // Le compte vient du stockage du navigateur : la ligne du surtitre est
        // réservée tant qu'il n'est pas lu, sinon le titre, les onglets et le
        // pied de page descendaient de 28 px à son arrivée.
        reserveEyebrow={view === "objects" && !ready}
        eyebrow={
          view === "objects"
            ? ready
              ? ts("objectsCount", { count: items.length })
              : undefined
            : ts("creationsCount", { count: creations.length })
        }
      />

      <fieldset className="mt-8 min-w-0">
        <legend className="sr-only">{ts("tabsLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          <ChipRadio
            name="favorites-view"
            value="objects"
            checked={view === "objects"}
            onChange={() => setView("objects")}
          >
            {ts("tabObjects")}
          </ChipRadio>
          <ChipRadio
            name="favorites-view"
            value="creations"
            checked={view === "creations"}
            onChange={() => setView("creations")}
          >
            {ts("tabCreations")}
          </ChipRadio>
        </div>
      </fieldset>

      {view === "objects" ? (
        // Hauteur réservée avant la lecture du stockage : la section est vide
        // au rendu serveur, puis reçoit soit l'état « vide » (~180 px), soit la
        // grille. Sans plancher, le pied de page (et tout ce qui le suit)
        // tombait d'un bloc (0,08 de décalage de mise en page). La moitié de
        // l'écran couvre l'état vide et le début de la grille, et place le
        // pied de page sous la ligne de flottaison sur un écran courant.
        <section
          aria-label={ts("tabObjects")}
          aria-busy={!ready}
          className="mt-8 min-h-[50svh]"
        >
          {!ready ? null : items.length === 0 ? (
            <div className="max-w-xl py-6">
              <p className="text-lead text-ink">{t("empty")}</p>
              <ButtonLink
                href="/shop"
                variant="primary"
                size="lg"
                className="mt-6"
              >
                {t("browse")}
              </ButtonLink>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                {/* En contour : chaque carte porte déjà son « Ajouter au
                    panier » (composant du catalogue), et un écran n'a qu'un
                    seul bouton rouge au plus. */}
                <Button
                  variant={addedAll ? "ink" : "secondary"}
                  onClick={addAllToCart}
                >
                  {addedAll ? (
                    <Check size={16} strokeWidth={1.5} />
                  ) : (
                    <ShoppingBag size={16} strokeWidth={1.5} />
                  )}
                  {addedAll ? t("addedAll") : t("addAll")}
                </Button>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
                {items.map((item) => (
                  <li
                    key={item.productId}
                    className="relative flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors duration-150 hover:border-ink"
                  >
                    <div className="relative aspect-square overflow-hidden bg-paper">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                      <FavoriteButton
                        item={item}
                        className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-surface/90 backdrop-blur"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      {/* Lien étiré : toute la carte mène à la fiche, sans
                          bouton imbriqué dans un lien. */}
                      <h2 className="font-semibold leading-snug">
                        <Link
                          href={`/products/${item.slug}`}
                          className="after:absolute after:inset-0"
                        >
                          {item.name}
                        </Link>
                      </h2>
                      <p className="s3d-num mt-1 font-semibold">
                        {formatChf(item.priceCents, locale)}
                      </p>
                      <div className="relative z-10 mt-3">
                        <AddToCartMini item={item} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <section aria-label={ts("tabCreations")} className="mt-8">
          {shownCreations.length === 0 ? (
            <div className="max-w-xl py-6">
              <h2 className="font-display text-title text-ink">
                {ts("creationsEmptyTitle")}
              </h2>
              <p className="mt-3 text-lead text-soft">
                {ts("creationsEmptyText")}
              </p>
              <ButtonLink
                href="/studio"
                variant="primary"
                size="lg"
                className="mt-6"
              >
                <StrataIcon size={20} />
                {tCta("studio")}
              </ButtonLink>
            </div>
          ) : (
            <>
              <p className="max-w-xl text-sm text-soft">
                {ts("creationsNote")}
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {shownCreations.map((creation) => (
                  <li
                    key={creation.id}
                    className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
                  >
                    {/* ph-no-capture : la vignette peut montrer le texte du
                        visiteur (son nom sur une Cartouche). */}
                    <div className="ph-no-capture grid aspect-[4/3] place-items-center overflow-hidden bg-paper">
                      {creation.thumbnail ? (
                        <img
                          src={creation.thumbnail}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <StrataIcon size={40} className="text-iso-index" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h2 className="font-semibold leading-snug">
                        {ts(`objects.${creation.object}`)}
                      </h2>
                      {creation.label && (
                        <p className="s3d-label ph-no-capture normal-case text-ink">
                          {creation.label}
                        </p>
                      )}
                      <p className="text-sm text-soft">
                        {ts("savedOn", {
                          date: new Date(creation.savedAt).toLocaleDateString(
                            `${locale}-CH`,
                          ),
                        })}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {/* Les textes saisis repartent par sessionStorage
                            (jamais dans l'URL) : le Studio les relit à
                            l'ouverture. */}
                        <ButtonLink
                          href={`/studio/${creation.object}${creationHash(creation.fragment)}`}
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (creation.texts)
                              writeStudioTexts(creation.object, creation.texts);
                          }}
                        >
                          {ts("reopen")}
                        </ButtonLink>
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => {
                            removeCreation(creation.id);
                            toast.show(ts("deleted"));
                          }}
                        >
                          {ts("delete")}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
}
