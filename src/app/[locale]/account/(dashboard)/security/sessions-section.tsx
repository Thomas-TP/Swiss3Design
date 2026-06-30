"use client";

import { useEffect, useState } from "react";
import { Laptop, MapPin, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useSession,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from "@/lib/auth-client";
import { describeUserAgent } from "@/lib/user-agent";
import { card, btnGhost } from "../_ui";

type SessionRow = {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
};

export function SessionsSection() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { data } = useSession();
  const currentToken = (data?.session as { token?: string } | undefined)?.token;

  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function load() {
    const { data: rows } = await listSessions();
    setSessions((rows as SessionRow[] | null) ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    listSessions().then(({ data: rows }) => {
      if (!cancelled) setSessions((rows as SessionRow[] | null) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRevoke(token: string) {
    setRevoking(token);
    await revokeSession({ token });
    await load();
    setRevoking(null);
  }

  async function onRevokeOthers() {
    setRevoking("__others__");
    await revokeOtherSessions();
    await load();
    setRevoking(null);
  }

  if (sessions === null) return null;

  const others = sessions.filter((s) => s.token !== currentToken);

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Laptop size={18} className="shrink-0 text-soft" />
          <div>
            <p className="text-sm font-semibold">{t("security.sessions.title")}</p>
            <p className="mt-0.5 text-xs text-soft">{t("security.sessions.desc")}</p>
          </div>
        </div>
        {others.length > 0 && (
          <button
            type="button"
            onClick={onRevokeOthers}
            disabled={revoking !== null}
            className={`${btnGhost} shrink-0 !py-2 text-xs`}
          >
            <ShieldAlert size={13} />
            {t("security.sessions.revokeAllOthers")}
          </button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-line">
        {sessions.map((s) => {
          const { browser, os } = describeUserAgent(s.userAgent);
          const isCurrent = s.token === currentToken;
          const label =
            browser && os
              ? t("security.sessions.browserOn", { browser, os })
              : t("security.sessions.unknownDevice");
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {label}
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {t("security.sessions.thisDevice")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-soft">
                  {s.ipAddress && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {s.ipAddress}
                    </span>
                  )}
                  <span>
                    {new Date(s.createdAt).toLocaleDateString(`${locale}-CH`)}
                  </span>
                </p>
              </div>
              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => onRevoke(s.token)}
                  disabled={revoking !== null}
                  className="shrink-0 text-xs font-semibold text-accent transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {revoking === s.token
                    ? t("security.processing")
                    : t("security.sessions.revoke")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
