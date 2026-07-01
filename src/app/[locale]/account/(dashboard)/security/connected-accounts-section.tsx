"use client";

import { useEffect, useState } from "react";
import { Link2, Link2Off, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { listAccounts, linkSocial, unlinkAccount } from "@/lib/auth-client";
import { SOCIAL_ICONS, SOCIAL_LABELS } from "@/components/social-icons";
import { card, btnGhost } from "../_ui";

export function ConnectedAccountsSection({
  providers,
}: {
  providers: string[];
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [linked, setLinked] = useState<string[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await listAccounts();
    setLinked((data ?? []).map((a) => a.providerId));
  }

  useEffect(() => {
    let cancelled = false;
    listAccounts().then(({ data }) => {
      if (!cancelled) setLinked((data ?? []).map((a) => a.providerId));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0 || linked === null) return null;

  async function onLink(provider: string) {
    setPending(provider);
    setError(null);
    await linkSocial({
      provider: provider as "google" | "apple" | "facebook",
      callbackURL: `/${locale}/account/security`,
    });
  }

  async function onUnlink(provider: string) {
    setPending(provider);
    setError(null);
    const { error: err } = await unlinkAccount({ providerId: provider });
    setPending(null);
    if (err) {
      setError(t("security.connected.errorUnlink"));
      return;
    }
    await load();
  }

  return (
    <div className={card}>
      <div className="flex items-center gap-2.5">
        <Users size={18} className="shrink-0 text-soft" />
        <div>
          <p className="text-sm font-semibold">{t("security.connected.title")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("security.connected.desc")}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-line">
        {providers.map((p) => {
          const isLinked = linked.includes(p);
          return (
            <li key={p} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2.5 text-sm font-medium">
                {SOCIAL_ICONS[p]}
                {SOCIAL_LABELS[p]}
              </span>
              {isLinked ? (
                <button
                  type="button"
                  onClick={() => onUnlink(p)}
                  disabled={pending !== null}
                  className={`${btnGhost} !py-2 text-xs`}
                >
                  <Link2Off size={13} />
                  {pending === p ? t("security.processing") : t("security.connected.unlink")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onLink(p)}
                  disabled={pending !== null}
                  className={`${btnGhost} !py-2 text-xs`}
                >
                  <Link2 size={13} />
                  {pending === p ? t("security.processing") : t("security.connected.link")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm font-medium text-accent">{error}</p>}
    </div>
  );
}
