"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send, Paperclip, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/select";
import { useSession } from "@/lib/auth-client";
import { medusa, loginToMedusa } from "@/lib/medusa";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

interface QuoteFile {
  url: string;
  name: string;
}

// Envoie directement au module Medusa "quotes" (Phase 3 : /store/quotes,
// /store/quotes/upload) — pas une route custom sur l'app racine. Ce module
// existe déjà côté Medusa (Postgres) avec son propre panel admin, aucune
// raison de faire transiter les devis par D1. Liste de matières :
// réutilise /store/filters (déjà construit pour le catalogue) plutôt qu'une
// nouvelle route - simplification assumée (matières du catalogue publié).
export function QuoteForm() {
  const t = useTranslations("custom");
  const locale = useLocale();
  const { data: authSession } = useSession();
  const [materials, setMaterials] = useState<string[]>([]);
  const [material, setMaterial] = useState("");
  const [file, setFile] = useState<QuoteFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    medusa.client
      .fetch<{ materials: string[] }>("/store/filters")
      .then(({ materials: m }) => setMaterials(m))
      .catch(() => {});
  }, []);

  // /custom est une page publique (pas sous le layout du tableau de bord qui
  // établit le pont Medusa) : sans ceci, un client connecté via better-auth
  // mais n'ayant jamais visité /account soumettrait un devis "invité" côté
  // Medusa (customer_id jamais rattaché, req.auth_context.actor_id absent).
  useEffect(() => {
    if (!authSession) return;
    medusa.store.customer.retrieve().catch(() => {
      loginToMedusa(authSession.user.email).catch(() => {});
    });
  }, [authSession]);

  async function onFile(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) return;
    setUploading(true);
    setFileError(false);
    try {
      const body = new FormData();
      body.append("file", selected);
      const token = await medusa.client.getToken();
      const res = await fetch(`${MEDUSA_URL}/store/quotes/upload`, {
        method: "POST",
        headers: {
          "x-publishable-api-key": PUBLISHABLE_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { file_url: string; file_name: string };
      setFile({ url: data.file_url, name: data.file_name });
    } catch {
      setFileError(true);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setStatus("idle");
    const data = new FormData(e.currentTarget);
    try {
      await medusa.client.fetch("/store/quotes", {
        method: "POST",
        body: {
          email: data.get("email"),
          description: data.get("description"),
          material: material || undefined,
          colors: (data.get("colors") as string) || undefined,
          dimensions: (data.get("dimensions") as string) || undefined,
          file_url: file?.url,
          file_name: file?.name,
          locale,
        },
      });
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
        <p className="mt-4 font-semibold text-emerald-800 dark:text-emerald-200">{t("success")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          {t("email")}
        </label>
        <input
          key={authSession?.user.email ?? "anon"}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={authSession?.user.email ?? ""}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-semibold">
          {t("description")}
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          rows={5}
          placeholder={t("descriptionPlaceholder")}
          className={field}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="material" className="mb-1.5 block text-sm font-semibold">
            {t("material")} <span className="font-normal text-soft">({t("optional")})</span>
          </label>
          <Select
            value={material}
            onChange={setMaterial}
            options={[{ value: "", label: t("materialAny") }, ...materials.map((m) => ({ value: m, label: m }))]}
            placeholder={t("materialAny")}
            ariaLabel={t("material")}
          />
        </div>
        <div>
          <label htmlFor="colors" className="mb-1.5 block text-sm font-semibold">
            {t("colors")} <span className="font-normal text-soft">({t("optional")})</span>
          </label>
          <input id="colors" name="colors" placeholder={t("colorsPlaceholder")} className={field} />
        </div>
      </div>

      <div>
        <label htmlFor="dimensions" className="mb-1.5 block text-sm font-semibold">
          {t("dimensions")} <span className="font-normal text-soft">({t("optional")})</span>
        </label>
        <input id="dimensions" name="dimensions" placeholder={t("dimensionsPlaceholder")} className={field} />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">
          {t("file")} <span className="font-normal text-soft">({t("optional")})</span>
        </span>
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Paperclip size={15} className="shrink-0 text-soft" />
              <span className="truncate font-medium">{file.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="×"
              className="rounded-full p-1 text-soft transition-colors hover:bg-line/60 hover:text-accent"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-4 text-sm font-medium text-soft transition-colors hover:border-ink hover:text-ink">
            <Paperclip size={16} />
            {uploading ? t("fileUploading") : t("fileHint")}
            <input
              type="file"
              accept=".stl,.3mf,.obj"
              disabled={uploading}
              onChange={(e) => onFile(e.currentTarget)}
              className="hidden"
            />
          </label>
        )}
        {fileError && <p className="mt-1.5 text-xs font-medium text-accent">{t("fileError")}</p>}
      </div>

      {status === "error" && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{t("error")}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Send size={16} />
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
