import { ClientMessages } from "@/i18n/client-messages";

// Messages client de /custom : le formulaire de devis (QuoteRequestForm,
// QuoteFileField, la carte « Configuration Studio jointe ») lit `custom` et
// `quote` (dont `quote.studioCard`) ; `shell.cta` vient de la racine.
export default function CustomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["custom", "quote"]}>{children}</ClientMessages>
  );
}
