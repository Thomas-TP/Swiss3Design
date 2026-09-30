import { ClientMessages } from "@/i18n/client-messages";

// Messages client de l'écran de consentement OAuth (ConsentForm).
export default function OAuthConsentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["agentAccess.consent"]}>
      {children}
    </ClientMessages>
  );
}
