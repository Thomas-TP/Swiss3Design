"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";
import { btnGhostSm } from "./_ui";

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
      className={btnGhostSm}
    >
      <LogOut size={14} strokeWidth={1.5} />
      {t("signOut")}
    </button>
  );
}
