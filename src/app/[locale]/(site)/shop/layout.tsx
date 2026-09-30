import { ClientMessages } from "@/i18n/client-messages";

// Messages client de la boutique : la bascule grille / registre
// (ShopCollection). La carte produit (`product`, `favorites`) vient du layout
// du groupe (site).
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["catalog.shop.view"]}>
      {children}
    </ClientMessages>
  );
}
