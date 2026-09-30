import { ClientMessages } from "@/i18n/client-messages";

// Messages client de la page de rattachement d'un agent (ClaimForm).
export default function AgentClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["agentAccess.claim"]}>
      {children}
    </ClientMessages>
  );
}
