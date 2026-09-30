"use client";

import { useActionState, useState } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, fieldClass } from "@/components/ui/field";
import {
  alertError,
  alertSuccess,
  alertWarn,
  btnAccentLg,
  btnGhost,
  linkAccent,
} from "../../account/(dashboard)/_ui";
import { confirmAgentClaim, denyAgentClaim, type ClaimState } from "./actions";

// Code à 6 chiffres à recopier : chasse fixe, interlettrage large, centré.
const codeField = `${fieldClass} text-center font-mono tracking-[0.4em] placeholder:tracking-normal`;

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
        <output
          className={
            done === "confirmed"
              ? `${alertSuccess} block`
              : "block rounded-field border border-line bg-paper px-4 py-3 text-sm font-medium text-soft"
          }
        >
          {t(done === "confirmed" ? "confirmed" : "denied")}
        </output>
        <Link href="/account/agents" className={`${linkAccent} text-sm`}>
          {t("manage")}
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className={`${alertWarn} flex gap-2`}>
        <ShieldAlert size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        {t("warning")}
      </p>
      <form action={confirm} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <Field label={t("codeLabel")} htmlFor="code">
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
            className={codeField}
          />
        </Field>
        {error && (
          <p role="alert" className={alertError}>
            {t(`errors.${error}`, { remaining: confirmState.remaining ?? 0 })}
          </p>
        )}
        <button
          type="submit"
          disabled={confirming || denying || code.length < 6}
          className={btnAccentLg}
        >
          <Check size={16} strokeWidth={1.5} />
          {confirming ? t("processing") : t("confirm")}
        </button>
      </form>
      <form action={deny}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={confirming || denying}
          className={`${btnGhost} w-full`}
        >
          <X size={16} strokeWidth={1.5} />
          {denying ? t("processing") : t("deny")}
        </button>
      </form>
    </div>
  );
}
