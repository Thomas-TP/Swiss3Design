"use client";

import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { SOCIAL_ICONS, SOCIAL_LABELS } from "@/components/social-icons";
import { buttonClass } from "@/components/ui/button";

const socialButton = buttonClass({ variant: "secondary", full: true });

export function SocialButtons({
  providers,
  next = "/account",
}: {
  providers: string[];
  next?: string;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  if (providers.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs text-soft">
        <span className="h-px flex-1 bg-line" />
        {t("orContinueWith")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-4 grid gap-2.5">
        {providers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() =>
              authClient.signIn.social({
                provider: p as "google" | "apple" | "facebook",
                callbackURL: `/${locale}${next}`,
              })
            }
            className={socialButton}
          >
            {SOCIAL_ICONS[p]}
            {SOCIAL_LABELS[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
