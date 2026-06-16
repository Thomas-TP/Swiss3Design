"use client";

import { useRef, useState, useTransition } from "react";
import { Reorder } from "motion/react";
import {
  Sparkles,
  GripVertical,
  Plus,
  X,
  Check,
  Search,
  Loader2,
  ImageOff,
} from "lucide-react";
import { saveFeaturedSelection } from "./actions";

export interface FeaturedProduct {
  id: string;
  name: string;
  priceLabel: string;
  imageUrl: string | null;
}

function Thumb({ product }: { product: FeaturedProduct }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-line/30 text-soft">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <ImageOff size={16} />
      )}
    </div>
  );
}

export function FeaturedManager({
  all,
  initialSelectedIds,
}: {
  all: FeaturedProduct[];
  initialSelectedIds: string[];
}) {
  const byId = new Map(all.map((p) => [p.id, p]));
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enregistrement automatique débounced : add/retrait/réordonnancement
  // envoient la liste complète et ordonnée à l'action serveur.
  const commit = (ids: string[]) => {
    setSelectedIds(ids);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        await saveFeaturedSelection(ids);
        setSaved(true);
      });
    }, 500);
  };

  const add = (id: string) => commit([...selectedIds, id]);
  const remove = (id: string) => commit(selectedIds.filter((x) => x !== id));

  const selectedProducts = selectedIds
    .map((id) => byId.get(id))
    .filter((p): p is FeaturedProduct => Boolean(p));

  const q = query.trim().toLowerCase();
  const available = all.filter(
    (p) => !selectedIds.includes(p.id) && (!q || p.name.toLowerCase().includes(q)),
  );

  return (
    <div>
      {/* État d'enregistrement */}
      <div className="mb-4 flex h-5 items-center gap-1.5 text-xs font-medium">
        {isPending ? (
          <span className="flex items-center gap-1.5 text-soft">
            <Loader2 size={13} className="animate-spin" />
            Enregistrement…
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Check size={13} />
            Sélection enregistrée
          </span>
        ) : (
          <span className="text-soft/70">
            Aperçu en direct sur la page d&apos;accueil
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sélection courante (réordonnable) */}
        <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Sparkles size={16} className="text-accent" />
              Dans la sélection
            </h3>
            <span className="rounded-full bg-line/60 px-2 py-0.5 text-xs font-bold tabular-nums text-soft">
              {selectedProducts.length}
            </span>
          </div>

          {selectedProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-soft">
              <Sparkles size={20} className="mx-auto mb-2 opacity-50" />
              Aucun produit mis en avant.
              <br />
              Ajoutez-en depuis le catalogue à droite.
            </div>
          ) : (
            <>
              <Reorder.Group
                axis="y"
                values={selectedIds}
                onReorder={commit}
                className="space-y-2"
              >
                {selectedProducts.map((p, i) => (
                  <Reorder.Item
                    key={p.id}
                    value={p.id}
                    className="flex cursor-grab items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 active:cursor-grabbing"
                  >
                    <GripVertical size={16} className="shrink-0 text-soft/60" />
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold tabular-nums text-paper">
                      {i + 1}
                    </span>
                    <Thumb product={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-soft">{p.priceLabel}</p>
                    </div>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => remove(p.id)}
                      aria-label={`Retirer ${p.name} de la sélection`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-soft transition-colors hover:bg-accent/10 hover:text-accent"
                    >
                      <X size={16} />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
              <p className="mt-3 text-xs text-soft/80">
                Glissez pour réordonner · 3, 6 ou 9 produits remplissent
                joliment la grille.
              </p>
            </>
          )}
        </section>

        {/* Catalogue disponible */}
        <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <h3 className="mb-3 font-semibold">Ajouter un produit</h3>
          <div className="relative mb-3">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans le catalogue…"
              className="w-full rounded-xl border border-line bg-paper py-2.5 pl-9 pr-3.5 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none"
            />
          </div>

          {available.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-soft">
              {q
                ? "Aucun produit ne correspond."
                : "Tout le catalogue est déjà mis en avant."}
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {available.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-line hover:bg-paper"
                  >
                    <Thumb product={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-soft">{p.priceLabel}</p>
                    </div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-paper transition-transform group-hover:scale-105">
                      <Plus size={16} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
