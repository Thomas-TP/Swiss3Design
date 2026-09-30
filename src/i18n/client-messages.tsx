import { getMessages } from "next-intl/server";
import { pickMessages } from "./client-namespaces";
import { MessagesScope } from "./messages-scope";
import type { Messages } from "./namespaces";

/**
 * Envoie au navigateur les messages dont les composants « use client » d'un
 * segment ou d'une page ont besoin, EN PLUS de ceux de la racine (voir
 * client-namespaces.ts). À poser dans le `layout.tsx` du segment, ou autour du
 * sous-arbre concerné d'une page :
 *
 *   <ClientMessages namespaces={["catalog.viewer"]}>{children}</ClientMessages>
 *
 * `namespaces` = les arguments des useTranslations() lus côté client par ce
 * sous-arbre (un composant serveur n'en a pas besoin). Un namespace oublié se
 * voit tout de suite : MISSING_MESSAGE dans la console du navigateur en
 * développement, et client-messages.test.ts échoue.
 */
export async function ClientMessages({
  namespaces,
  children,
}: {
  namespaces: readonly string[];
  children: React.ReactNode;
}) {
  const messages = pickMessages((await getMessages()) as Messages, namespaces);
  return <MessagesScope messages={messages}>{children}</MessagesScope>;
}
