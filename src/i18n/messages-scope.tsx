"use client";

import { useMemo } from "react";
import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import { mergeMessages } from "./client-namespaces";
import type { Messages } from "./namespaces";

// Côté client de <ClientMessages> : pose un fournisseur imbriqué dont les
// messages sont ceux du parent PLUS ceux de la page. next-intl ne fusionne pas
// de lui-même (un `messages` imbriqué remplace ceux du parent), d'où cette
// fusion ; le reste de la configuration (fuseau, formats, repli d'erreur) est
// repris du parent par le fournisseur.
export function MessagesScope({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const parent = useMessages() as Messages;
  const merged = useMemo(
    () => mergeMessages(parent, messages),
    [parent, messages],
  );
  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
