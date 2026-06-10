"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { submitQuoteRequest, type QuoteFormState } from "./actions";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export function QuoteForm() {
  const t = useTranslations("custom");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<QuoteFormState, FormData>(
    submitQuoteRequest,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <div className="rounded-card border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
        <p className="mt-4 font-semibold text-emerald-800">{t("success")}</p>
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
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
          <select id="material" name="material" className={field} defaultValue="">
            <option value="">{t("materialAny")}</option>
            <option value="PLA">PLA</option>
            <option value="PETG">PETG</option>
          </select>
        </div>
        <div>
          <label htmlFor="colors" className="mb-1.5 block text-sm font-semibold">
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

      {state.status === "error" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent">
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
