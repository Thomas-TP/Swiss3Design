"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { DeleteAccount } from "./delete-account";

// L'export de données (nLPD/RGPD) est reporté : il agrège commandes/devis/
// adresses depuis D1 côté app racine (voir requête interne), en attente
// d'une route API cross-origine dédiée (Phase 2, cf. décision utilisateur).
export default function PrivacyTab() {
  const t = useTranslations("account");

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Lock size={19} className="text-soft" />
        {t("privacy.title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("privacy.subtitle")}</p>

      <div className="space-y-4">
        <DeleteAccount />
      </div>
    </div>
  );
}
