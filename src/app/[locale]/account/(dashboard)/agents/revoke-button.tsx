"use client";

import { useActionState } from "react";
import { Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { revokeAccess, type RevokeState } from "./actions";

export function RevokeButton({
  kind,
  id,
}: {
  kind: "app" | "agent";
  id: string;
}) {
  const t = useTranslations("agentAccess.account");
  const [state, action, pending] = useActionState<RevokeState, FormData>(
    revokeAccess,
    {},
  );
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending || state.success}
        className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <Unlink size={14} />
        {pending ? t("revoking") : state.success ? t("revoked") : t("revoke")}
      </button>
      {state.error && (
        <p className="mt-1 text-xs text-accent">{t("revokeError")}</p>
      )}
    </form>
  );
}
