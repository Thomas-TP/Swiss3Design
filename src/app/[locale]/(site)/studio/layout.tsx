import { ClientMessages } from "@/i18n/client-messages";

// Messages client du Studio (brief « Strates », §9.2, AGENTS.md règle d'or 11) :
// `studio` (réglages, tiroir, barre d'outils) et `studioCore` (noms d'objets, de
// filaments, garde-fous, unités) pour StudioApp ; `quote` et `custom` pour le
// formulaire de devis PARTAGÉ du tiroir « Envoyer à l'atelier » (QuoteRequestForm
// et la carte de pièce jointe). `shell` (vue 3D, tiroir, toasts) vient de la
// racine ; l'index du Studio n'a aucun composant client, il n'en paie rien de
// plus que ces quatre fichiers, que le navigateur ne reçoit que sur /studio.
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientMessages namespaces={["studio", "studioCore", "quote", "custom"]}>
      {children}
    </ClientMessages>
  );
}
