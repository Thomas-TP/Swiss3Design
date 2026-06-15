"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  saveProduct,
  deleteProduct,
  type ProductFormState,
} from "./actions";
import { FIELD, BTN_PRIMARY, BTN_GHOST } from "../ui";

interface Img {
  url: string;
  alt?: string;
}

export interface ProductFormInitial {
  id: string;
  slug: string;
  priceCents: number;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  material: string;
  dimensionsMm: string | null;
  weightGrams: number | null;
  stock: number | null;
  multicolor: boolean;
  featured: boolean;
  active: boolean;
  translations: Record<string, { name: string; description: string }>;
  images: Img[];
  categoryIds: string[];
  variants: VariantInitial[];
}

interface VariantInitial {
  name: string;
  sku: string;
  priceCents: number | null;
  stock: number | null;
}

const LOCALE_LABELS: Record<string, string> = {
  fr: "Français",
  de: "Allemand",
  it: "Italien",
  en: "Anglais",
};

export function ProductForm({
  categories,
  materials,
  initial,
}: {
  categories: { id: string; name: string }[];
  materials: string[];
  initial?: ProductFormInitial;
}) {
  // La matière du produit en cours peut avoir été retirée de la palette :
  // on l'ajoute aux options pour ne pas la perdre silencieusement.
  const materialOptions = Array.from(
    new Set([
      ...materials,
      ...(initial?.material ? [initial.material] : []),
    ]),
  );
  const defaultMaterial =
    initial?.material ??
    (materialOptions.includes("PLA") ? "PLA" : materialOptions[0]);
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    saveProduct,
    {},
  );

  // Navigation côté client après succès : redirect() dans l'action
  // laissait l'interface figée sur Cloudflare Workers.
  useEffect(() => {
    if (state.success) {
      router.push("/admin/products");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-8">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      {/* Informations générales */}
      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Informations générales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Prix (CHF) *</span>
            <input
              name="price"
              required
              inputMode="decimal"
              defaultValue={
                initial ? (initial.priceCents / 100).toFixed(2) : ""
              }
              placeholder="29.90"
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              Slug{" "}
              <span className="font-normal text-soft">
                (vide = généré du nom)
              </span>
            </span>
            <input
              name="slug"
              defaultValue={initial?.slug ?? ""}
              placeholder="vase-spirale"
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Type de vente</span>
            <select
              name="saleType"
              defaultValue={initial?.saleType ?? "stock"}
              className={FIELD}
            >
              <option value="stock">En stock (expédition rapide)</option>
              <option value="on_demand">Imprimé à la demande</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              Délai production (jours){" "}
              <span className="font-normal text-soft">(si à la demande)</span>
            </span>
            <input
              name="productionDays"
              type="number"
              min={1}
              max={60}
              defaultValue={initial?.productionDays ?? 3}
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              Stock{" "}
              <span className="font-normal text-soft">(vide = non suivi)</span>
            </span>
            <input
              name="stock"
              type="number"
              min={0}
              defaultValue={initial?.stock ?? ""}
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Matière</span>
            {materialOptions.length > 0 ? (
              <select
                name="material"
                defaultValue={defaultMaterial}
                className={FIELD}
              >
                {materialOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl border border-line bg-line/20 px-3 py-2 text-xs text-soft">
                Aucun filament.{" "}
                <Link href="/admin/materials" className="underline">
                  Ajoutez-en un
                </Link>{" "}
                pour pouvoir le choisir.
              </p>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Dimensions</span>
            <input
              name="dimensionsMm"
              defaultValue={initial?.dimensionsMm ?? ""}
              placeholder="120 × 120 × 220 mm"
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Poids (g)</span>
            <input
              name="weightGrams"
              type="number"
              min={1}
              defaultValue={initial?.weightGrams ?? ""}
              className={FIELD}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          {(
            [
              ["multicolor", "Multicolore (AMS)", initial?.multicolor ?? false],
              ["featured", "Mettre en vedette", initial?.featured ?? false],
              ["active", "Publié (visible en boutique)", initial?.active ?? true],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                name={name}
                defaultChecked={checked}
                className="h-4 w-4 accent-accent"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Traductions */}
      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-1 font-semibold">Nom & description</h2>
        <p className="mb-4 text-xs text-soft">
          Le français est obligatoire ; les langues laissées vides reprendront
          le texte français.
        </p>
        <div className="space-y-5">
          {(["fr", "de", "it", "en"] as const).map((l) => (
            <fieldset key={l} className="rounded-xl border border-line p-4">
              <legend className="px-1.5 text-xs font-bold uppercase tracking-wide text-soft">
                {LOCALE_LABELS[l]}
                {l === "fr" && " *"}
              </legend>
              <div className="space-y-3">
                <input
                  name={`name_${l}`}
                  required={l === "fr"}
                  defaultValue={initial?.translations[l]?.name ?? ""}
                  placeholder="Nom du produit"
                  className={FIELD}
                />
                <textarea
                  name={`desc_${l}`}
                  required={l === "fr"}
                  rows={2}
                  defaultValue={initial?.translations[l]?.description ?? ""}
                  placeholder="Description"
                  className={FIELD}
                />
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* Catégories */}
      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Catégories</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                name="categories"
                value={c.id}
                defaultChecked={initial?.categoryIds.includes(c.id)}
                className="h-4 w-4 accent-accent"
              />
              {c.name}
            </label>
          ))}
        </div>
      </section>

      {/* Variantes */}
      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-1 font-semibold">Variantes</h2>
        <p className="mb-4 text-xs text-soft">
          Couleurs, tailles… Laissez vide si le produit n&apos;a qu&apos;une
          seule version. Prix vide = prix du produit, stock vide = non suivi.
        </p>
        <VariantManager initial={initial?.variants ?? []} />
      </section>

      {/* Images */}
      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Photos</h2>
        <ImageManager initial={initial?.images ?? []} />
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
        <Link href="/admin/products" className={BTN_GHOST}>
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
        if (!confirm("Supprimer définitivement ce produit ?")) return;
        setDeleting(true);
        try {
          await deleteProduct(id);
          router.push("/admin/products");
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

interface VariantRow {
  name: string;
  sku: string;
  price: string;
  stock: string;
}

function VariantManager({ initial }: { initial: VariantInitial[] }) {
  const [rows, setRows] = useState<VariantRow[]>(
    initial.map((v) => ({
      name: v.name,
      sku: v.sku,
      price: v.priceCents != null ? (v.priceCents / 100).toFixed(2) : "",
      stock: v.stock != null ? String(v.stock) : "",
    })),
  );

  const update = (i: number, patch: Partial<VariantRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(rows.filter((r) => r.name.trim()))}
      />
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-soft sm:grid sm:grid-cols-[1fr_1fr_90px_80px_36px]">
            <span>Nom</span>
            <span>SKU</span>
            <span>Prix</span>
            <span>Stock</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_90px_80px_36px]"
            >
              <input
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Rouge"
                className={FIELD}
              />
              <input
                value={r.sku}
                onChange={(e) => update(i, { sku: e.target.value })}
                placeholder="auto"
                className={FIELD}
              />
              <input
                value={r.price}
                onChange={(e) => update(i, { price: e.target.value })}
                inputMode="decimal"
                placeholder="prix"
                className={FIELD}
              />
              <input
                value={r.stock}
                onChange={(e) => update(i, { stock: e.target.value })}
                inputMode="numeric"
                placeholder="stock"
                className={FIELD}
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Retirer la variante"
                className="grid place-items-center rounded-xl border border-line text-soft transition-colors hover:border-accent hover:text-accent"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          setRows((prev) => [...prev, { name: "", sku: "", price: "", stock: "" }])
        }
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink"
      >
        <Plus size={15} />
        Ajouter une variante
      </button>
    </div>
  );
}

function ImageManager({ initial }: { initial: Img[] }) {
  const [images, setImages] = useState<Img[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        if (!res.ok) {
          const reason =
            res.status === 413
              ? "fichier trop lourd (max 8 Mo)"
              : res.status === 415
                ? "format non supporté (JPG, PNG, WebP, AVIF ou SVG)"
                : res.status === 403
                  ? "session expirée — reconnectez-vous"
                  : `erreur serveur (${res.status})`;
          throw new Error(reason);
        }
        const { url } = (await res.json()) as { url: string };
        setImages((prev) => [...prev, { url }]);
      } catch (e) {
        const reason =
          e instanceof Error && e.message
            ? e.message
            : "connexion interrompue";
        setError(`Échec de l'envoi de ${file.name} : ${reason}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(index: number, delta: number) {
    setImages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div
            key={img.url}
            className="group relative h-24 w-24 overflow-hidden rounded-xl border border-line bg-line/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                Principale
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/70 py-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(i, -1)}
                className="text-white/90 hover:text-white"
                aria-label="Avancer"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setImages((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-white/90 hover:text-white"
                aria-label="Retirer"
              >
                <X size={13} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                className="text-white/90 hover:text-white"
                aria-label="Reculer"
              >
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-soft transition-colors hover:border-ink hover:text-ink">
          <Upload size={18} />
          <span className="text-[10px] font-semibold">
            {uploading ? "Envoi…" : "Ajouter"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            multiple
            disabled={uploading}
            onChange={(e) => onFiles(e.target.files)}
            className="hidden"
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs font-medium text-accent">{error}</p>
      )}
      <p className="mt-2 text-xs text-soft">
        JPG, PNG ou WebP, 8 Mo max. La première photo est l&apos;image
        principale.
      </p>
    </div>
  );
}
