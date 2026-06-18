"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Layers, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  addMaterial,
  deleteMaterial,
  addColor,
  deleteColor,
  type MaterialFormState,
  type ColorFormState,
} from "./actions";
import { FIELD, BTN_PRIMARY } from "../ui";

export interface ColorItem {
  id: string;
  name: string;
  hex: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  count: number;
  colors: ColorItem[];
}

export function MaterialsManager({ materials }: { materials: MaterialItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    MaterialFormState,
    FormData
  >(addMaterial, {});

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className="max-w-2xl">
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
          {pending ? "Ajout…" : "Ajouter un filament"}
        </button>
      </form>

      {materials.length === 0 ? (
        <div className="mt-5 rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">Aucun filament pour l&apos;instant.</p>
          <p className="mt-1 text-sm">
            Ajoutez-en un, puis sa palette de couleurs.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {materials.map((m) => (
            <FilamentCard key={m.id} material={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilamentCard({ material }: { material: MaterialItem }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Layers size={16} className="shrink-0 text-soft" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{material.name}</p>
          <p className="text-xs text-soft">
            {material.count} produit{material.count > 1 ? "s" : ""} ·{" "}
            {material.colors.length} couleur
            {material.colors.length > 1 ? "s" : ""}
          </p>
        </div>
        <DeleteMaterialButton material={material} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {material.colors.map((c) => (
          <ColorChip key={c.id} color={c} />
        ))}
        {material.colors.length === 0 && (
          <p className="text-xs text-soft">
            Aucune couleur — ajoutez-en une ci-dessous.
          </p>
        )}
      </div>

      <AddColorForm materialId={material.id} />
    </section>
  );
}

function ColorChip({ color }: { color: ColorItem }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1.5 pr-2 text-xs font-medium">
      <span
        className="h-4 w-4 shrink-0 rounded-full border border-swatch-ring"
        style={{ backgroundColor: color.hex }}
      />
      {color.name}
      <button
        type="button"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          try {
            await deleteColor(color.id);
            router.refresh();
          } catch {
            setDeleting(false);
          }
        }}
        aria-label={`Supprimer la couleur ${color.name}`}
        className="rounded-full p-0.5 text-soft transition-colors hover:bg-line/60 hover:text-accent"
      >
        <X size={13} />
      </button>
    </span>
  );
}

function AddColorForm({ materialId }: { materialId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ColorFormState, FormData>(
    addColor,
    {},
  );

  // form.reset() restaure aussi la couleur par défaut du sélecteur (non contrôlé).
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"
    >
      <input type="hidden" name="materialId" value={materialId} />
      <input
        type="color"
        name="hex"
        defaultValue="#E5231C"
        aria-label="Choisir la couleur"
        className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
      />
      <input
        name="name"
        required
        maxLength={40}
        placeholder="Nom (ex. Rouge feu)"
        className={`${FIELD} min-w-0 flex-1`}
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
      >
        <Plus size={15} />
        {pending ? "Ajout…" : "Couleur"}
      </button>
      {state.error && (
        <p className="w-full text-xs font-medium text-accent">{state.error}</p>
      )}
    </form>
  );
}

function DeleteMaterialButton({ material }: { material: MaterialItem }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={async () => {
        const warn =
          material.count > 0
            ? `Retirer « ${material.name} » ? Les ${material.count} produit(s) qui l'utilisent gardent cette matière, mais elle (et ses couleurs) ne seront plus proposées.`
            : `Retirer « ${material.name} » et ses couleurs ?`;
        if (!confirm(warn)) return;
        setDeleting(true);
        try {
          await deleteMaterial(material.id);
          router.refresh();
        } catch {
          setDeleting(false);
          alert("Échec de la suppression, réessayez.");
        }
      }}
      aria-label={`Supprimer ${material.name}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-red-500/20"
    >
      <Trash2 size={14} />
      Supprimer
    </button>
  );
}
