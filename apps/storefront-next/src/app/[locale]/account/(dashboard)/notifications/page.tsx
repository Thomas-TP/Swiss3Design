"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { readToken } from "@/lib/auth-client";
import { card } from "../_ui";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

interface Prefs {
  newsletter: boolean;
  productNews: boolean;
}

async function authedFetch(path: string, init?: RequestInit) {
  const token = readToken();
  return fetch(`${BETTER_AUTH_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-soft">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

// Concept génuinement D1-only (aucun équivalent Medusa) : nouvelle route
// cross-origine sur l'app racine, /api/account/notification-preferences.
export default function NotificationsTab() {
  const t = useTranslations("account");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authedFetch("/api/account/notification-preferences")
      .then((res) => res.json())
      .then((data: Prefs) => setPrefs(data))
      .catch(() => setPrefs({ newsletter: false, productNews: false }));
  }, []);

  async function save(next: Prefs) {
    setPrefs(next);
    setPending(true);
    setSaved(false);
    try {
      await authedFetch("/api/account/notification-preferences", { method: "POST", body: JSON.stringify(next) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Bell size={19} className="text-soft" />
        {t("notifications.title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("notifications.subtitle")}</p>

      <div className="space-y-4">
        <div className={card}>
          {prefs && (
            <div>
              <div className="divide-y divide-line">
                <Toggle
                  checked={prefs.newsletter}
                  onChange={(v) => save({ ...prefs, newsletter: v })}
                  label={t("notifications.newsletter")}
                  desc={t("notifications.newsletterDesc")}
                />
                <Toggle
                  checked={prefs.productNews}
                  onChange={(v) => save({ ...prefs, productNews: v })}
                  label={t("notifications.productNews")}
                  desc={t("notifications.productNewsDesc")}
                />
              </div>
              {(pending || saved) && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-soft">
                  {saved && <Check size={13} className="text-emerald-600" />}
                  {pending ? t("security.processing") : t("profile.saved")}
                </p>
              )}
            </div>
          )}
        </div>
        <p className={`${card} text-xs text-soft`}>{t("notifications.transactionalNote")}</p>
      </div>
    </div>
  );
}
