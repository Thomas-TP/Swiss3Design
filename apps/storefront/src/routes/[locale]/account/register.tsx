import { createSignal, onCleanup, Show } from "solid-js";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { UserPlus, MailCheck, LoaderCircle } from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { BrandMark } from "../../../components/brand-mark";
import { signUp, signIn, captureToken } from "../../../lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

// Miroir de register-form.tsx côté app Next.js. Même scope réduit que
// login.tsx (pas de connexion sociale ici non plus).
export default function RegisterPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultEmail = () => {
    const e = typeof searchParams.email === "string" ? searchParams.email : "";
    return /^\S+@\S+\.\S+$/.test(e) ? e.toLowerCase() : "";
  };

  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [waiting, setWaiting] = createSignal<{ email: string; password: string } | null>(null);
  const [signingIn, setSigningIn] = createSignal(false);
  let signedIn = false;

  function startPolling(email: string, password: string) {
    let lastAttempt = 0;
    const attempt = async () => {
      if (signedIn || Date.now() - lastAttempt < 55_000) return;
      lastAttempt = Date.now();
      const { data, error: err } = await signIn.email({ email, password }, { onSuccess: captureToken });
      if (err || !data) return;
      if ((data as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
        navigate(`/${locale()}/account/login`);
        return;
      }
      signedIn = true;
      setSigningIn(true);
      navigate(`/${locale()}/account`);
    };
    attempt();
    const id = setInterval(attempt, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") attempt();
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    });
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const { data: result, error: err } = await signUp.email(
      { name: String(data.get("name")), email, password, callbackURL: `${window.location.origin}/${locale()}/account` },
      { onSuccess: captureToken },
    );
    if (err) {
      setError(
        err.status === 422 ? t("auth.errorExists") : err.status === 400 ? t("auth.errorWeakPassword") : t("auth.errorGeneric"),
      );
      setPending(false);
      return;
    }
    if (!result?.token) {
      setWaiting({ email, password });
      setPending(false);
      startPolling(email, password);
      return;
    }
    navigate(`/${locale()}/account`);
  }

  return (
    <div class="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark class="mx-auto h-10 w-10 text-ink" />
      <h1 class="mt-5 text-center text-3xl font-bold tracking-tight">{t("auth.signUpTitle")}</h1>
      <div class="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <Show
          when={!waiting()}
          fallback={
            <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <MailCheck size={28} class="mx-auto text-emerald-600" />
              <p class="mt-3 text-sm font-medium leading-relaxed text-emerald-800 dark:text-emerald-200">
                {t("auth.verifyNotice")}
              </p>
              <p class="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                <LoaderCircle size={14} class="animate-spin" />
                {signingIn() ? t("auth.verifySigningIn") : t("auth.verifyWaiting")}
              </p>
            </div>
          }
        >
          <form method="post" onSubmit={onSubmit} class="space-y-4">
            <div>
              <label for="name" class="mb-1.5 block text-sm font-semibold">
                {t("auth.name")}
              </label>
              <input id="name" name="name" required minlength={2} autocomplete="name" class={field} />
            </div>
            <div>
              <label for="email" class="mb-1.5 block text-sm font-semibold">
                {t("auth.email")}
              </label>
              <input id="email" name="email" type="email" required autocomplete="email" value={defaultEmail()} class={field} />
            </div>
            <div>
              <label for="password" class="mb-1.5 block text-sm font-semibold">
                {t("auth.password")}
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
              <UserPlus size={16} />
              {t("auth.signUpCta")}
            </button>
          </form>
        </Show>
      </div>
      <p class="mt-5 text-center text-sm text-soft">
        {t("auth.haveAccount")} <A href={`/${locale()}/account/login`} class="font-semibold text-accent hover:underline">{t("auth.signInTitle")}</A>
      </p>
      <p class="mt-3 text-center text-sm text-soft">
        <A href={`/${locale()}/track`} class="font-medium hover:text-ink hover:underline">
          {t("auth.trackOrderLink")}
        </A>
      </p>
    </div>
  );
}
