"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("auth");
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-soft transition-colors hover:border-ink hover:text-ink"
    >
      <LogOut size={14} />
      {t("signOut")}
    </button>
  );
}
