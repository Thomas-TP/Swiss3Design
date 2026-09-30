import { ClientMessages } from "@/i18n/client-messages";

// Messages client de la fiche produit : le viewer 3D (ProductViewer). L'achat
// et les favoris (`product`, `favorites`) viennent du layout du groupe (site),
// la vue du Stage (`shell.stage`) de la racine.
export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["catalog.viewer"]}>{children}</ClientMessages>
  );
}
