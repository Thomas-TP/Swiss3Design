import { ClientMessages } from "@/i18n/client-messages";

// Messages client de l'Atelier : le formulaire de contact (`contact`,
// `atelier.form`) et la vitrine des imprimantes (`atelier.showcase`).
export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages
      namespaces={["atelier.form", "atelier.showcase", "contact"]}
    >
      {children}
    </ClientMessages>
  );
}
