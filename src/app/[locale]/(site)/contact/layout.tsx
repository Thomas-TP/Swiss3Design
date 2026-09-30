import { ClientMessages } from "@/i18n/client-messages";

// Messages client de /contact : le formulaire de contact (`contact`,
// `atelier.form`).
export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["atelier.form", "contact"]}>
      {children}
    </ClientMessages>
  );
}
