"use client";

import { useEffect, useState } from "react";
import { Laptop, MapPin, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession, listSessions, revokeSession, revokeOtherSessions } from "@/lib/auth-client";
import { groupByDevice, type SessionLike } from "@/lib/session-groups";
import { card, btnGhost } from "../_ui";

type SessionRow = SessionLike & { id: string };

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

  async function onRevokeGroup(tokens: string[]) {
    setRevoking(tokens[0]);
    for (const token of tokens) {
      await revokeSession({ token });
    }
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

  const groups = groupByDevice(sessions, currentToken);
  const hasOtherSessions = sessions.some((s) => s.token !== currentToken);

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
        {hasOtherSessions && (
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
        {groups.map((g) => {
          const label =
            g.browser && g.os ? t("security.sessions.browserOn", { browser: g.browser, os: g.os }) : t("security.sessions.unknownDevice");
          // Sur le groupe de l'appareil courant, seules les AUTRES sessions du
          // même appareil sont révocables (jamais la session en cours).
          const revocableTokens = g.sessions.filter((s) => s.token !== currentToken).map((s) => s.token);
          const otherCount = g.sessions.length - (g.isCurrent ? 1 : 0);

          return (
            <li key={g.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {label}
                  {g.isCurrent && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {t("security.sessions.thisDevice")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-soft">
                  {g.ipAddress && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {g.ipAddress}
                    </span>
                  )}
                  <span>{g.lastActive.toLocaleDateString(`${locale}-CH`)}</span>
                  {otherCount > 0 && <span>{t("security.sessions.otherSessions", { count: otherCount })}</span>}
                </p>
              </div>
              {revocableTokens.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRevokeGroup(revocableTokens)}
                  disabled={revoking !== null}
                  className="shrink-0 text-xs font-semibold text-accent transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {revoking === revocableTokens[0] ? t("security.processing") : t("security.sessions.revoke")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
