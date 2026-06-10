import { CircleUser } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AccountPage() {
  const t = await getTranslations("account");

  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <div className="rounded-card border border-line bg-surface p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper ring-1 ring-line">
          <CircleUser size={26} strokeWidth={1.6} className="text-soft" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">{t("comingSoon")}</h1>
        <p className="mt-3 leading-relaxed text-soft">{t("comingSoonText")}</p>
      </div>
    </div>
  );
}
