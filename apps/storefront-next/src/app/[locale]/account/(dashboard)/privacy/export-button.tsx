"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient, readToken } from "@/lib/auth-client";
import { medusa } from "@/lib/medusa";
import { btnPrimary } from "../_ui";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

// Contrairement à l'app racine (Server Action, une seule requête D1), la
// plupart des sources ont déjà migré vers Medusa (commandes, devis,
// adresses) ou sont déjà accessibles côté client (profil/passkeys via
// authClient) : l'export se reconstruit donc entièrement côté client, sans
// nouvelle route dédiée, à l'exception des préférences de notification
// (seul reliquat D1-only, même route que l'onglet Notifications).
export function ExportButton() {
  const t = useTranslations("account");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onExport() {
    setPending(true);
    setError(false);
    try {
      const { data: session } = await authClient.getSession();
      if (!session) throw new Error("unauthorized");
      const user = session.user as typeof session.user & { twoFactorEnabled?: boolean };

      const token = readToken();
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [ordersRes, quotesRes, addressesRes, passkeysRes, prefsRes] = await Promise.all([
        medusa.store.order.list({ fields: "display_id,fulfillment_status,total,shipping_address,created_at" }).catch(() => ({ orders: [] })),
        medusa.client.fetch<{ quotes: unknown[] }>("/store/quotes").catch(() => ({ quotes: [] })),
        medusa.store.customer.listAddress().catch(() => ({ addresses: [] })),
        authClient.passkey.listUserPasskeys().catch(() => ({ data: [] })),
        fetch(`${BETTER_AUTH_URL}/api/account/notification-preferences`, { headers: authHeaders })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        account: {
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled ?? false,
          createdAt: user.createdAt,
        },
        orders: ordersRes.orders,
        quotes: quotesRes.quotes,
        addresses: addressesRes.addresses,
        passkeys: "data" in passkeysRes ? passkeysRes.data : [],
        notificationPreferences: prefsRes,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `swiss3design-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onExport} disabled={pending} className={btnPrimary}>
        <Download size={15} />
        {pending ? t("security.processing") : t("privacy.exportButton")}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-accent">{t("privacy.exportError")}</p>}
    </div>
  );
}
