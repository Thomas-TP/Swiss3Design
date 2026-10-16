import { ClientMessages } from "@/i18n/client-messages";

// Messages client de /custom : le formulaire de devis (QuoteRequestForm,
// QuoteFileField, la carte « Configuration Studio jointe ») lit `custom` et
// `quote` (dont `quote.studioCard`) ; l'aperçu 3D du fichier (ProductViewer,
// ViewerCredits) lit `catalog.viewer` ; `shell.cta` vient de la racine.
export default function CustomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["custom", "quote", "catalog.viewer"]}>
      {children}
    </ClientMessages>
  );
}
