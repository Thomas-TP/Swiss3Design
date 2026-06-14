"use client";

import { useActionState, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  saveCategory,
  deleteCategory,
  type CategoryFormState,
} from "./actions";
import { FIELD, BTN_PRIMARY, BTN_GHOST } from "../ui";

export interface CategoryFormInitial {
  id: string;
  slug: string;
  sortOrder: number;
  translations: Record<string, string>;
}

const LOCALE_LABELS: Record<string, string> = {
  fr: "Français",
  de: "Allemand",
  it: "Italien",
  en: "Anglais",
};

export function CategoryForm({ initial }: { initial?: CategoryFormInitial }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CategoryFormState,
    FormData
  >(saveCategory, {});

  useEffect(() => {
    if (state.success) {
      router.push("/admin/categories");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              Slug{" "}
              <span className="font-normal text-soft">(vide = généré)</span>
            </span>
            <input
              name="slug"
              defaultValue={initial?.slug ?? ""}
              placeholder="deco"
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Ordre d&apos;affichage</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={initial?.sortOrder ?? 0}
              className={FIELD}
            />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {(["fr", "de", "it", "en"] as const).map((l) => (
            <label key={l} className="block text-sm">
              <span className="mb-1.5 block font-semibold">
                {LOCALE_LABELS[l]}
                {l === "fr" && " *"}
              </span>
              <input
                name={`name_${l}`}
                required={l === "fr"}
                defaultValue={initial?.translations[l] ?? ""}
                placeholder="Nom de la catégorie"
                className={FIELD}
              />
            </label>
          ))}
        </div>
      </section>

      {state.error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          <Save size={16} />
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Link href="/admin/categories" className={BTN_GHOST}>
          Annuler
        </Link>
        {initial && <DeleteButton id={initial.id} />}
      </div>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={async () => {
        if (
          !confirm(
            "Supprimer cette catégorie ? Les produits ne seront pas supprimés, seulement déliés.",
          )
        )
          return;
        setDeleting(true);
        try {
          await deleteCategory(id);
          router.push("/admin/categories");
          router.refresh();
        } catch {
          setDeleting(false);
          alert("Échec de la suppression, réessayez.");
        }
      }}
      className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-red-500/20"
    >
      <Trash2 size={14} />
      Supprimer
    </button>
  );
}
