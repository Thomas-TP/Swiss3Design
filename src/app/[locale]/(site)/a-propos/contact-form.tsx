"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Field, fieldClass } from "@/components/ui/field";
import { useSession } from "@/lib/auth-client";
import { submitContactMessage, type ContactFormState } from "./actions";

// Formulaire de contact de l'Atelier et de /contact. Habillage « Strates » :
// champs = primitive Field (libellé mono, bordure puis encre au focus, halo
// `ring-ink`, 16 px en mobile contre le zoom d'iOS), un seul bouton rouge (le
// bouton d'envoi, l'action principale de l'écran). Envoi inchangé : même
// Server Action, mêmes noms de champs, même honeypot, même `{ status }`.
export function ContactForm() {
  const t = useTranslations("contact");
  const tForm = useTranslations("atelier.form");
  const locale = useLocale();
  const { data: authSession } = useSession();
  const [state, formAction, pending] = useActionState<
    ContactFormState,
    FormData
  >(submitContactMessage, { status: "idle" });

  if (state.status === "success") {
    return (
      // <output> : rôle « status » implicite, annoncé par les lecteurs d'écran.
      <output className="block rounded-card border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <CheckCircle2
          size={32}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mx-auto text-emerald-600"
        />
        <span className="mt-4 block font-semibold text-emerald-800 dark:text-emerald-200">
          {t("success")}
        </span>
      </output>
    );
  }

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot anti-spam : caché des humains, ignoré des lecteurs d'écran. */}
      <div aria-hidden className="hidden">
        <label>
          Société
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} htmlFor="name" required>
          <input
            key={authSession?.user.name ?? "anon-name"}
            id="name"
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            defaultValue={authSession?.user.name ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label={t("email")} htmlFor="email" required>
          <input
            key={authSession?.user.email ?? "anon-email"}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={authSession?.user.email ?? ""}
            className={fieldClass}
          />
        </Field>
      </div>

      <Field
        label={
          <>
            {t("subject")}{" "}
            <span className="normal-case">({t("optional")})</span>
          </>
        }
        htmlFor="subject"
      >
        <input
          id="subject"
          name="subject"
          maxLength={150}
          className={fieldClass}
        />
      </Field>

      <Field label={t("message")} htmlFor="message" required>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={6}
          placeholder={t("messagePlaceholder")}
          className={cx(fieldClass, "resize-y")}
        />
      </Field>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-field bg-accent/10 px-4 py-3 text-sm font-medium text-accent-text"
        >
          {t("error")}
        </p>
      )}

      <p className="text-sm text-soft">{tForm("requiredNote")}</p>

      <Button type="submit" variant="primary" full disabled={pending}>
        <Send size={16} strokeWidth={1.5} aria-hidden="true" />
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
