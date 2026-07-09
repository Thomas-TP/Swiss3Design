"use client";

import { useEffect, useRef, useState } from "react";
import { CircleUser, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateUser } from "@/lib/auth-client";

// 10 avatars prédéfinis (pas d'upload : zéro modération, zéro stockage).
// Un compte Google garde sa photo de profil tant qu'il n'en choisit pas un.
const AVATARS = Array.from(
  { length: 10 },
  (_, i) => `/avatars/a${String(i + 1).padStart(2, "0")}.svg`,
);

export function AvatarPicker({ current }: { current: string | null }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(url: string) {
    if (saving) return;
    setSaving(url);
    try {
      await updateUser({ image: url });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("avatarChange")}
        className="relative block transition-transform active:scale-95"
      >
        {current ? (
          <img
            src={current}
            alt=""
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-surface ring-1 ring-line">
            <CircleUser size={24} strokeWidth={1.6} className="text-soft" />
          </span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper ring-2 ring-paper">
          <Pencil size={10} />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-60 rounded-xl border border-line bg-surface p-3.5 shadow-lg shadow-ink/5">
          <p className="text-xs font-semibold text-soft">{t("avatarTitle")}</p>
          <div className="mt-2.5 grid grid-cols-5 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => pick(a)}
                disabled={saving !== null}
                className={`overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                  current === a
                    ? "ring-accent"
                    : "ring-transparent hover:ring-line"
                } ${saving === a ? "animate-pulse" : ""}`}
              >
                <img src={a} alt="" className="h-9 w-9" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
