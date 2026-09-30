"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

// Bascule Grille / Registre de la boutique (brief « Strates », §7.8). Le
// serveur rend la grille (le contenu complet, lisible sans JS et par les
// moteurs) et passe aussi le Registre ; ce composant n'affiche qu'un des deux.
// Le choix vit dans `localStorage["s3d-shop-view"]` : aucun paramètre d'URL de
// plus (robots.txt et la liste blanche d'analytics n'en savent rien). Lecture par
// useSyncExternalStore : le serveur et l'hydratation voient « grille », puis
// React relit le stockage, sans écart d'hydratation ni effet qui change d'état.

export type ShopView = "grid" | "registry";
const STORAGE_KEY = "s3d-shop-view";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Autre onglet : l'événement « storage » ne part que dans les AUTRES onglets.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readView(): ShopView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "registry"
      ? "registry"
      : "grid";
  } catch {
    // Stockage bloqué (fenêtre privée, cookies refusés) : la grille.
    return "grid";
  }
}

function writeView(view: ShopView) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Sans stockage le choix vaut pour cette visite seulement (pas de relecture).
  }
  for (const listener of Array.from(listeners)) listener();
}

export function ShopCollection({
  summary,
  sort,
  grid,
  registry,
}: {
  /** Compteur de résultats (texte serveur). */
  summary: ReactNode;
  /** Puces de tri (liens serveur). */
  sort: ReactNode;
  grid: ReactNode;
  registry: ReactNode;
}) {
  const t = useTranslations("catalog.shop.view");
  const view = useSyncExternalStore(subscribe, readView, () => "grid" as const);

  const option = (value: ShopView, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => writeView(value)}
      className={cx(
        "inline-flex h-9 items-center gap-2 px-3 text-sm font-medium transition-colors duration-150 ease-strate",
        view === value ? "bg-ink text-paper" : "text-ink hover:bg-line/60",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {summary}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {sort}
          <fieldset className="m-0 inline-flex min-w-0 overflow-hidden rounded-field border border-ink p-0">
            <legend className="sr-only">{t("label")}</legend>
            {option("grid", t("grid"), <LayoutGrid size={16} />)}
            {option("registry", t("registry"), <Rows3 size={16} />)}
          </fieldset>
        </div>
      </div>
      <div className="mt-6">{view === "registry" ? registry : grid}</div>
    </div>
  );
}
