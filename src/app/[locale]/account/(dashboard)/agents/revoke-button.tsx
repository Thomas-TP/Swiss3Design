"use client";

import { useActionState } from "react";
import { Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { btnGhostSm } from "../_ui";
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
        className={btnGhostSm}
      >
        <Unlink size={14} strokeWidth={1.5} />
        {pending ? t("revoking") : state.success ? t("revoked") : t("revoke")}
      </button>
      {state.error && (
        <p className="mt-1 text-xs font-medium text-accent-text">
          {t("revokeError")}
        </p>
      )}
    </form>
  );
}
