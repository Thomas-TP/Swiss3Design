import { createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { MailCheck, Send } from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { BrandMark } from "../../../components/brand-mark";
import { authClient } from "../../../lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

// Miroir de forgot-form.tsx côté app Next.js.
export default function ForgotPasswordPage() {
  const { t, locale } = useI18n();
  const [pending, setPending] = createSignal(false);
  const [sent, setSent] = createSignal(false);

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setPending(true);
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    await authClient.requestPasswordReset({
      email: String(data.get("email")),
      // Absolu vers le storefront (origine cross-domain avec le serveur
      // d'auth) : sans ça, le lien de l'e-mail pointerait vers l'origine de
      // baseURL (l'app Next.js) au lieu du storefront.
      redirectTo: `${window.location.origin}/${locale()}/account/reset-password`,
    });
    // Toujours afficher le succès : ne révèle pas si l'e-mail existe
    setSent(true);
  }

  return (
    <div class="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark class="mx-auto h-10 w-10 text-ink" />
      <h1 class="mt-5 text-center text-3xl font-bold tracking-tight">{t("auth.forgotTitle")}</h1>
      <p class="mt-3 text-center text-sm text-soft">{t("auth.forgotIntro")}</p>
      <div class="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <Show
          when={!sent()}
          fallback={
            <div class="text-center">
              <MailCheck size={28} class="mx-auto text-emerald-600" />
              <p class="mt-3 text-sm font-medium leading-relaxed text-soft">{t("auth.resetSent")}</p>
            </div>
          }
        >
          <form method="post" onSubmit={onSubmit} class="space-y-4">
            <div>
              <label for="email" class="mb-1.5 block text-sm font-semibold">
                {t("auth.email")}
              </label>
              <input id="email" name="email" type="email" required autocomplete="email" class={field} />
            </div>
            <button
              type="submit"
              disabled={pending()}
              class="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
            >
              <Send size={16} />
              {pending() ? t("auth.processing") : t("auth.sendReset")}
            </button>
          </form>
        </Show>
      </div>
      <p class="mt-5 text-center text-sm text-soft">
        <A href={`/${locale()}/account/login`} class="font-semibold text-accent hover:underline">
          {t("auth.signInTitle")}
        </A>
      </p>
    </div>
  );
}
