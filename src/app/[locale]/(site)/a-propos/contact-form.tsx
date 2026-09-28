"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { submitContactMessage, type ContactFormState } from "./actions";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const { data: authSession } = useSession();
  const [state, formAction, pending] = useActionState<
    ContactFormState,
    FormData
  >(submitContactMessage, { status: "idle" });

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
      {/* Honeypot anti-spam : caché des humains, ignoré des lecteurs d'écran. */}
      <div aria-hidden className="hidden">
        <label>
          Société
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
            {t("name")}
          </label>
          <input
            key={authSession?.user.name ?? "anon-name"}
            id="name"
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            defaultValue={authSession?.user.name ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
            {t("email")}
          </label>
          <input
            key={authSession?.user.email ?? "anon-email"}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={authSession?.user.email ?? ""}
            className={field}
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-semibold">
          {t("subject")}{" "}
          <span className="font-normal text-soft">({t("optional")})</span>
        </label>
        <input id="subject" name="subject" maxLength={150} className={field} />
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-semibold">
          {t("message")}
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={5}
          placeholder={t("messagePlaceholder")}
          className={field}
        />
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
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
