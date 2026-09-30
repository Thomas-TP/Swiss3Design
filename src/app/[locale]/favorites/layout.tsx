import { ClientMessages } from "@/i18n/client-messages";

// Messages client des favoris : la liste (FavoritesList : `favorites`,
// `system.favorites`) et la carte produit qu'elle réutilise (`product`).
// `shell.cta` et `shell.ui` (toast) viennent de la racine. Hors du groupe
// (site), donc pas de `product`/`favorites` hérités : on les déclare ici.
export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["favorites", "product", "system.favorites"]}>
      {children}
    </ClientMessages>
  );
}
