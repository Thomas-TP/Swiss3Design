import { ClientMessages } from "@/i18n/client-messages";

// Messages client du suivi de commande (TrackFlow) : son propre texte
// (`track`, `system.track`) et les libellés de statut partagés avec le compte
// (`account.status`).
export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["account.status", "system.track", "track"]}>
      {children}
    </ClientMessages>
  );
}
