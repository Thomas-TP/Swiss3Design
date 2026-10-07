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

// Favoris (brief « Strates » §7.17) : UNE seule liste, les objets de la
// boutique (localStorage `s3d-favorites-v1`) et les configurations gardées au
// Studio (« Mes créations », `s3d-creations-v1`) ensemble, avec un filtre
// « Tout · Objets · Mes créations » en puces du site (retour du propriétaire
// R13, 07.10.2026 : l'ancienne page les séparait en onglets). Hors groupe
// (site) : ni Lenis ni canvas. Tout reste dans ce navigateur : rien n'est
// envoyé, rien dans l'URL (le filtre ne s'y écrit pas non plus). Les puces sont
// des radios natives (ChipRadio) : flèches, annonce « 2 sur 3 » et focus gérés
// par le navigateur.

type Filter = "all" | "objects" | "creations";

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
  const [filter, setFilter] = useState<Filter>("all");
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
  const showObjects = filter !== "creations";
  const showCreations = filter !== "objects";
  const objectCards = showObjects ? items : [];
  const creationCards = showCreations ? shownCreations : [];
  const nothing = objectCards.length === 0 && creationCards.length === 0;
  // « Tout ajouter au panier » ne concerne que les objets : seul, il serait
  // ambigu au-dessus d'une liste qui mêle aussi des créations.
  const canAddAll =
    items.length > 0 && (filter === "objects" || creations.length === 0);

  // Surtitre : le compte de ce qui est affiché. « Tout » donne les deux
  // comptes ; un compte nul est tu tant que l'autre existe.
  const objectsCount = ts("objectsCount", { count: items.length });
  const creationsCount = ts("creationsCount", { count: creations.length });
  const eyebrow = !ready
    ? undefined
    : filter === "objects"
      ? objectsCount
      : filter === "creations"
        ? creationsCount
        : [
            items.length > 0 || creations.length === 0 ? objectsCount : null,
            creations.length > 0 ? creationsCount : null,
          ]
            .filter(Boolean)
            .join(" · ");

  return (
    <div className="s3d-page py-10 md:py-16">
      <PageHeader
        title={ts("title")}
        // Le compte vient du stockage du navigateur : la ligne du surtitre est
        // réservée tant qu'il n'est pas lu, sinon le titre, les puces et le
        // pied de page descendaient de 28 px à son arrivée.
        reserveEyebrow={!ready}
        eyebrow={eyebrow}
      />

      <fieldset className="mt-8 min-w-0">
        <legend className="sr-only">{ts("filterLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          <ChipRadio
            name="favorites-filter"
            value="all"
            checked={filter === "all"}
            onChange={() => setFilter("all")}
          >
            {ts("filterAll")}
          </ChipRadio>
          <ChipRadio
            name="favorites-filter"
            value="objects"
            checked={filter === "objects"}
            onChange={() => setFilter("objects")}
          >
            {ts("filterObjects")}
          </ChipRadio>
          <ChipRadio
            name="favorites-filter"
            value="creations"
            checked={filter === "creations"}
            onChange={() => setFilter("creations")}
          >
            {ts("filterCreations")}
          </ChipRadio>
        </div>
      </fieldset>

      {/* Hauteur réservée avant la lecture du stockage : la section est vide au
          rendu serveur, puis reçoit soit un état « vide » (~180 px), soit la
          grille. Sans plancher, le pied de page (et tout ce qui le suit)
          tombait d'un bloc (0,08 de décalage de mise en page). La moitié de
          l'écran couvre l'état vide et le début de la grille, et place le pied
          de page sous la ligne de flottaison sur un écran courant. */}
      <section aria-busy={!ready} className="mt-8 min-h-[50svh]">
        {!ready ? null : nothing ? (
          <EmptyState
            filter={filter}
            labels={{
              all: ts("emptyAll"),
              objects: t("empty"),
              creationsTitle: ts("creationsEmptyTitle"),
              creationsText: ts("creationsEmptyText"),
              browse: t("browse"),
              studio: tCta("studio"),
            }}
          />
        ) : (
          <>
            {(canAddAll || (showCreations && creationCards.length > 0)) && (
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                {showCreations && creationCards.length > 0 ? (
                  <p className="max-w-xl text-sm text-soft">
                    {ts("creationsNote")}
                  </p>
                ) : (
                  <span />
                )}
                {/* En contour : chaque carte porte déjà son « Ajouter au
                    panier » (composant du catalogue), et un écran n'a qu'un
                    seul bouton rouge au plus. */}
                {canAddAll && (
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
                )}
              </div>
            )}
            <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
              {objectCards.map((item) => (
                <li
                  key={`o-${item.productId}`}
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
              {creationCards.map((creation) => (
                <li
                  key={`c-${creation.id}`}
                  className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
                >
                  {/* ph-no-capture : la vignette peut montrer le texte du
                      visiteur (son nom sur une Cartouche). */}
                  <div className="ph-no-capture relative grid aspect-square place-items-center overflow-hidden bg-paper">
                    {creation.thumbnail ? (
                      <img
                        src={creation.thumbnail}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <StrataIcon size={40} className="text-iso-index" />
                    )}
                    {/* Dans une liste mêlée, c'est ce qui distingue une
                        création gardée d'un objet de la boutique. */}
                    <span className="s3d-label absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-ink backdrop-blur">
                      {ts("tagCreation")}
                    </span>
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
                      {/* Les textes saisis repartent par sessionStorage (jamais
                          dans l'URL) : le Studio les relit à l'ouverture. */}
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

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
}

// État vide selon le filtre : « Tout » propose la boutique (bouton rouge) et le
// Studio (en contour) ; « Objets » la boutique ; « Mes créations » le Studio.
function EmptyState({
  filter,
  labels,
}: {
  filter: Filter;
  labels: {
    all: string;
    objects: string;
    creationsTitle: string;
    creationsText: string;
    browse: string;
    studio: string;
  };
}) {
  if (filter === "creations")
    return (
      <div className="max-w-xl py-6">
        <h2 className="font-display text-title text-ink">
          {labels.creationsTitle}
        </h2>
        <p className="mt-3 text-lead text-soft">{labels.creationsText}</p>
        <ButtonLink href="/studio" variant="primary" size="lg" className="mt-6">
          <StrataIcon size={20} />
          {labels.studio}
        </ButtonLink>
      </div>
    );
  return (
    <div className="max-w-xl py-6">
      <p className="text-lead text-ink">
        {filter === "all" ? labels.all : labels.objects}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/shop" variant="primary" size="lg">
          {labels.browse}
        </ButtonLink>
        {filter === "all" && (
          <ButtonLink href="/studio" variant="secondary" size="lg">
            <StrataIcon size={20} />
            {labels.studio}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
