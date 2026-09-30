import { ClientMessages } from "@/i18n/client-messages";

// Messages client de la page de retour Stripe : la question d'attribution
// (AttributionQuestion). Le tunnel de paiement (`checkout`, `footer`,
// `system.checkout`) les déclare dans sa page, pas dans son layout, pour que
// cette page n'en hérite pas.
export default function CheckoutSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["attribution"]}>{children}</ClientMessages>
  );
}
