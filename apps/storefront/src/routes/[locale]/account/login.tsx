import { createSignal, Show } from "solid-js";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { LogIn, ShieldCheck } from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { BrandMark } from "../../../components/brand-mark";
import { signIn, twoFactor, captureToken } from "../../../lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

// Connexion e-mail/mot de passe + 2FA (TOTP/code de récupération) - miroir de
// login-form.tsx côté app Next.js. **Scope volontairement réduit** : clé
// d'accès (WebAuthn), lien magique, code par e-mail et connexion sociale
// reportés - ces flux nécessitent chacun une vérification propre de leur
// comportement cross-origine (jeton porteur) avant d'être portés, cf. plan
// Phase 5. Le mot de passe/2FA est le chemin le plus emprunté et déjà
// vérifié compatible avec l'architecture bearer (Phase 4).
export default function LoginPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = () => {
    const n = typeof searchParams.next === "string" ? searchParams.next : "";
    return n.startsWith("/") && !n.startsWith("//") ? n : `/${locale()}/account`;
  };

  const [stage, setStage] = createSignal<"login" | "totp" | "backup">("login");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [code, setCode] = createSignal("");

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const { data: res, error: err } = await signIn.email(
      { email: String(data.get("email")), password: String(data.get("password")) },
      { onSuccess: captureToken },
    );
    if (err) {
      setError(
        err.status === 403 ? t("auth.errorUnverified") : err.status === 401 ? t("auth.errorInvalid") : t("auth.errorGeneric"),
      );
      setPending(false);
      return;
    }
    if ((res as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setStage("totp");
      setPending(false);
      return;
    }
    navigate(nextPath());
  }

  async function verify() {
    setPending(true);
    setError(null);
    const { error: err } =
      stage() === "backup"
        ? await twoFactor.verifyBackupCode({ code: code() }, { onSuccess: captureToken })
        : await twoFactor.verifyTotp({ code: code() }, { onSuccess: captureToken });
    setPending(false);
    if (err) {
      setError(t("auth.twoFactor.error"));
      return;
    }
    navigate(nextPath());
  }

  return (
    <div class="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark class="mx-auto h-10 w-10 text-ink" />
      <h1 class="mt-5 text-center text-3xl font-bold tracking-tight">{t("auth.signInTitle")}</h1>
      <div class="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <Show
          when={stage() === "login"}
          fallback={
            <div class="space-y-4">
              <p class="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} class="text-emerald-600" />
                {t("auth.twoFactor.title")}
              </p>
              <p class="text-sm text-soft">
                {stage() === "backup" ? t("auth.twoFactor.backupPrompt") : t("auth.twoFactor.prompt")}
              </p>
              <input
                value={code()}
                onInput={(e) =>
                  setCode(
                    stage() === "backup"
                      ? e.currentTarget.value.trim()
                      : e.currentTarget.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    verify();
                  }
                }}
                inputmode={stage() === "backup" ? "text" : "numeric"}
                autocomplete="one-time-code"
                placeholder={stage() === "backup" ? t("auth.twoFactor.backupCode") : t("auth.twoFactor.code")}
                class={`${field} ${stage() === "backup" ? "" : "tracking-[0.3em]"}`}
              />
              <Show when={error()}>
                <p class="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error()}</p>
              </Show>
              <button
                type="button"
                onClick={verify}
                disabled={pending() || code().length < 6}
                class="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                {pending() ? t("auth.processing") : t("auth.twoFactor.verify")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage(stage() === "backup" ? "totp" : "backup");
                  setCode("");
                  setError(null);
                }}
                class="block w-full text-center text-xs font-medium text-soft transition-colors hover:text-ink"
              >
                {stage() === "backup" ? t("auth.twoFactor.useTotp") : t("auth.twoFactor.useBackup")}
              </button>
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
            <div>
              <label for="password" class="mb-1.5 block text-sm font-semibold">
                {t("auth.password")}
              </label>
              <input id="password" name="password" type="password" required autocomplete="current-password" class={field} />
              <p class="mt-1.5 text-right">
                <A href={`/${locale()}/account/forgot-password`} class="text-xs font-medium text-soft transition-colors hover:text-accent">
                  {t("auth.forgotLink")}
                </A>
              </p>
            </div>
            <Show when={error()}>
              <p class="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error()}</p>
            </Show>
            <button
              type="submit"
              disabled={pending()}
              class="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
            >
              <LogIn size={16} />
              {t("auth.signInCta")}
            </button>
          </form>
        </Show>
      </div>
      <p class="mt-5 text-center text-sm text-soft">
        {t("auth.noAccount")} <A href={`/${locale()}/account/register`} class="font-semibold text-accent hover:underline">{t("auth.signUpTitle")}</A>
      </p>
      <p class="mt-3 text-center text-sm text-soft">
        <A href={`/${locale()}/track`} class="font-medium hover:text-ink hover:underline">
          {t("auth.trackOrderLink")}
        </A>
      </p>
    </div>
  );
}
