"use client";

import { useState } from "react";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { passkey } from "@/lib/auth-client";
import { describeUserAgent } from "@/lib/user-agent";
import { card, btnPrimary } from "../_ui";

type PasskeyRow = {
  id: string;
  name: string | null;
  deviceType: string;
  createdAt: string | null;
  providerLabel: string | null;
};

export function PasskeysSection({
  initialPasskeys,
}: {
  initialPasskeys: PasskeyRow[];
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    setPending("add");
    setError(null);
    const { browser, os } = describeUserAgent(
      typeof navigator !== "undefined" ? navigator.userAgent : null,
    );
    const name =
      browser && os ? `${browser} sur ${os}` : new Date().toLocaleDateString();
    const { error: err } = await passkey.addPasskey({ name });
    setPending(null);
    if (err) {
      // Annulation par l'utilisateur (boîte de dialogue système) : pas une erreur à afficher
      const code = "code" in err ? err.code : null;
      if (code !== "AUTH_CANCELLED" && code !== "ERROR_CEREMONY_ABORTED") {
        setError(t("security.passkeys.errorAdd"));
      }
      return;
    }
    router.refresh();
  }

  async function onDelete(id: string) {
    setPending(id);
    setError(null);
    const { error: err } = await passkey.deletePasskey({ id });
    setPending(null);
    if (err) {
      setError(t("security.passkeys.errorDelete"));
      return;
    }
    router.refresh();
  }

  return (
    <div className={card}>
      <div className="flex items-center gap-2.5">
        <Fingerprint size={18} className="shrink-0 text-soft" />
        <div>
          <p className="text-sm font-semibold">{t("security.passkeys.title")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("security.passkeys.desc")}</p>
        </div>
      </div>

      {initialPasskeys.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {initialPasskeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {p.name || p.providerLabel || t("security.passkeys.unnamed")}
                </p>
                {p.createdAt && (
                  <p className="mt-0.5 text-xs text-soft">
                    {new Date(p.createdAt).toLocaleDateString(`${locale}-CH`)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                disabled={pending !== null}
                className="shrink-0 text-soft transition-colors hover:text-accent disabled:opacity-40"
                aria-label={t("security.passkeys.delete")}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm font-medium text-accent">{error}</p>}

      <button
        type="button"
        onClick={onAdd}
        disabled={pending !== null}
        className={`${btnPrimary} mt-4`}
      >
        <Plus size={15} />
        {pending === "add" ? t("security.processing") : t("security.passkeys.add")}
      </button>
    </div>
  );
}
