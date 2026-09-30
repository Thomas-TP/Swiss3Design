"use client";

import { useEffect } from "react";

// Garde <html lang> à jour après un changement de langue SANS rechargement.
// Le <html> est dans le layout racine, partagé par toutes les langues : quand
// le visiteur passe de /fr/shop à /de/shop, Next ne re-rend que le segment
// [locale] qui change, pas ce layout, et l'attribut garderait l'ancienne
// langue (lecteurs d'écran, césure, correcteur orthographique). Au chargement
// du document, le serveur l'a déjà écrit juste : l'effet ne fait que rattraper
// les navigations côté client.
export function HtmlLangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
