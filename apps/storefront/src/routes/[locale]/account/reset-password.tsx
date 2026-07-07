import { createSignal, Show } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { CheckCircle2, KeyRound } from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { BrandMark } from "../../../components/brand-mark";
import { authClient } from "../../../lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

// Miroir de reset-form.tsx côté app Next.js.
export default function ResetPasswordPage() {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const token = () => (typeof searchParams.token === "string" ? searchParams.token : null);
  const hasError = () => Boolean(searchParams.error);

  const [pending, setPending] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const tok = token();
    if (!tok) return;
    setPending(true);
    setError(null);
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const { error: err } = await authClient.resetPassword({
      newPassword: String(data.get("password")),
      token: tok,
    });
    if (err) {
      setError(t("auth.resetInvalid"));
      setPending(false);
      return;
    }
    setDone(true);
  }

  return (
    <div class="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark class="mx-auto h-10 w-10 text-ink" />
      <h1 class="mt-5 text-center text-3xl font-bold tracking-tight">{t("auth.resetTitle")}</h1>
      <div class="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <Show
          when={token() && !hasError()}
          fallback={
            <div class="text-center">
              <p class="text-sm font-medium leading-relaxed text-accent">{t("auth.resetInvalid")}</p>
              <A href={`/${locale()}/account/forgot-password`} class="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
                {t("auth.forgotTitle")}
              </A>
            </div>
          }
        >
          <Show
            when={!done()}
            fallback={
              <div class="text-center">
                <CheckCircle2 size={28} class="mx-auto text-emerald-600" />
                <p class="mt-3 text-sm font-medium leading-relaxed text-soft">{t("auth.resetSuccess")}</p>
                <A
                  href={`/${locale()}/account/login`}
                  class="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
                >
                  {t("auth.signInCta")}
                </A>
              </div>
            }
          >
            <form method="post" onSubmit={onSubmit} class="space-y-4">
              <div>
                <label for="password" class="mb-1.5 block text-sm font-semibold">
                  {t("auth.resetTitle")}
                </label>
                <input id="password" name="password" type="password" required minlength={8} autocomplete="new-password" class={field} />
                <p class="mt-1 text-xs text-soft">{t("auth.passwordHint")}</p>
              </div>
              <Show when={error()}>
                <p class="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error()}</p>
              </Show>
              <button
                type="submit"
                disabled={pending()}
                class="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
              >
                <KeyRound size={16} />
                {pending() ? t("auth.processing") : t("auth.resetCta")}
              </button>
            </form>
          </Show>
        </Show>
      </div>
    </div>
  );
}
