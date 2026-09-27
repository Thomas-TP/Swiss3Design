"use client";

import { useActionState, useState } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { confirmAgentClaim, denyAgentClaim, type ClaimState } from "./actions";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-lg tracking-[0.4em] transition-colors placeholder:text-soft/60 placeholder:tracking-normal focus:border-ink focus:outline-none";

export function ClaimForm({ token }: { token: string }) {
  const t = useTranslations("agentAccess.claim");
  const [code, setCode] = useState("");
  const [confirmState, confirm, confirming] = useActionState<
    ClaimState,
    FormData
  >(confirmAgentClaim, {});
  const [denyState, deny, denying] = useActionState<ClaimState, FormData>(
    denyAgentClaim,
    {},
  );
  const done = confirmState.status ?? denyState.status;
  const error = confirmState.error ?? denyState.error;

  if (done)
    return (
      <div className="space-y-3 text-center">
        <p
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            done === "confirmed"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-surface text-soft"
          }`}
        >
          {t(done === "confirmed" ? "confirmed" : "denied")}
        </p>
        <Link
          href="/account/agents"
          className="text-sm font-medium text-accent hover:underline"
        >
          {t("manage")}
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="flex gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        {t("warning")}
      </p>
      <form action={confirm} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <label htmlFor="code" className="block text-sm font-semibold">
          {t("codeLabel")}
        </label>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          required
          className={field}
        />
        {error && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {t(`errors.${error}`, { remaining: confirmState.remaining ?? 0 })}
          </p>
        )}
        <button
          type="submit"
          disabled={confirming || denying || code.length < 6}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
        >
          <Check size={16} />
          {confirming ? t("processing") : t("confirm")}
        </button>
      </form>
      <form action={deny}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={confirming || denying}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
        >
          <X size={16} />
          {denying ? t("processing") : t("deny")}
        </button>
      </form>
    </div>
  );
}
