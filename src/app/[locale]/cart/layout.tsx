import { ClientMessages } from "@/i18n/client-messages";

// Messages client du panier : la liste (CartContent : `cart`, `system.cart`),
// le rappel et la reprise de panier (`cartReminder`), l'import d'un panier
// partagé (`cartLink`) et la vérification de l'e-mail invité (`checkout`).
// `shell.cta` vient de la racine.
export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages
      namespaces={[
        "cart",
        "cartLink",
        "cartReminder",
        "checkout",
        "system.cart",
      ]}
    >
      {children}
    </ClientMessages>
  );
}
