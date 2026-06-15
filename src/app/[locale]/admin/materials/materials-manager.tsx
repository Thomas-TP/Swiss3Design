"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addMaterial, deleteMaterial, type MaterialFormState } from "./actions";
import { FIELD, BTN_PRIMARY } from "../ui";

export interface MaterialItem {
  id: string;
  name: string;
  count: number;
}

export function MaterialsManager({ materials }: { materials: MaterialItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    MaterialFormState,
    FormData
  >(addMaterial, {});

  // Vider le champ + rafraîchir la liste après un ajout réussi.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className="max-w-xl">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-start gap-2"
      >
        <div className="min-w-0 flex-1">
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Nom du filament (ex. PLA Silk)"
            className={FIELD}
          />
          {state.error && (
            <p className="mt-1.5 text-xs font-medium text-accent">
              {state.error}
            </p>
          )}
        </div>
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          <Plus size={16} />
          {pending ? "Ajout…" : "Ajouter"}
        </button>
      </form>

      {materials.length === 0 ? (
        <div className="mt-5 rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">Aucun filament pour l&apos;instant.</p>
          <p className="mt-1 text-sm">
            Ajoutez-en pour les proposer à la création d&apos;un produit.
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-card border border-line bg-surface px-4">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Layers size={16} className="shrink-0 text-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-xs text-soft">
                  {m.count} produit{m.count > 1 ? "s" : ""}
                </p>
              </div>
              <DeleteButton item={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteButton({ item }: { item: MaterialItem }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={async () => {
        const warn =
          item.count > 0
            ? `Retirer « ${item.name} » de la liste ? Les ${item.count} produit(s) qui l'utilisent gardent cette matière, mais elle ne sera plus proposée.`
            : `Retirer « ${item.name} » de la liste ?`;
        if (!confirm(warn)) return;
        setDeleting(true);
        try {
          await deleteMaterial(item.id);
          router.refresh();
        } catch {
          setDeleting(false);
          alert("Échec de la suppression, réessayez.");
        }
      }}
      aria-label={`Supprimer ${item.name}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-red-500/20"
    >
      <Trash2 size={14} />
      Supprimer
    </button>
  );
}
