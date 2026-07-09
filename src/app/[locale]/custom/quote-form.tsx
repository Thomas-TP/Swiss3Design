"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Send, Paperclip, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/select";
import { useSession } from "@/lib/auth-client";
import { submitQuoteRequest, type QuoteFormState } from "./actions";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export function QuoteForm({ materials }: { materials: string[] }) {
  const t = useTranslations("custom");
  const locale = useLocale();
  const { data: authSession } = useSession();
  const [state, formAction, pending] = useActionState<QuoteFormState, FormData>(
    submitQuoteRequest,
    { status: "idle" },
  );
  const [material, setMaterial] = useState("");
  const [file, setFile] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState(false);

  async function onFile(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) return;
    setUploading(true);
    setFileError(false);
    try {
      const body = new FormData();
      body.append("file", selected);
      const res = await fetch("/api/quote-upload", { method: "POST", body });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { key: string; fileName: string };
      setFile({ key: data.key, name: data.fileName });
    } catch {
      setFileError(true);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  if (state.status === "success") {
    return (
      <div className="rounded-card border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
        <p className="mt-4 font-semibold text-emerald-800 dark:text-emerald-200">
          {t("success")}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

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
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-semibold"
        >
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
          <label
            htmlFor="material"
            className="mb-1.5 block text-sm font-semibold"
          >
            {t("material")}{" "}
            <span className="font-normal text-soft">({t("optional")})</span>
          </label>
          <Select
            name="material"
            value={material}
            onChange={setMaterial}
            options={[
              { value: "", label: t("materialAny") },
              ...materials.map((m) => ({ value: m, label: m })),
            ]}
            placeholder={t("materialAny")}
            ariaLabel={t("material")}
          />
        </div>
        <div>
          <label
            htmlFor="colors"
            className="mb-1.5 block text-sm font-semibold"
          >
            {t("colors")}{" "}
            <span className="font-normal text-soft">({t("optional")})</span>
          </label>
          <input
            id="colors"
            name="colors"
            placeholder={t("colorsPlaceholder")}
            className={field}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="dimensions"
          className="mb-1.5 block text-sm font-semibold"
        >
          {t("dimensions")}{" "}
          <span className="font-normal text-soft">({t("optional")})</span>
        </label>
        <input
          id="dimensions"
          name="dimensions"
          placeholder={t("dimensionsPlaceholder")}
          className={field}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">
          {t("file")}{" "}
          <span className="font-normal text-soft">({t("optional")})</span>
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
              accept=".stl,.3mf,.obj,.step,.stp"
              disabled={uploading}
              onChange={(e) => onFile(e.currentTarget)}
              className="hidden"
            />
          </label>
        )}
        {fileError && (
          <p className="mt-1.5 text-xs font-medium text-accent">
            {t("fileError")}
          </p>
        )}
        {file && <input type="hidden" name="fileKey" value={file.key} />}
        {file && <input type="hidden" name="fileName" value={file.name} />}
      </div>

      {state.status === "error" && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {t("error")}
        </p>
      )}

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
