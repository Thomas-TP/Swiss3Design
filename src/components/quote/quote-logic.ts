// Logique pure du formulaire de devis (brief « Strates », §7.10) : sans React,
// testable sous Node. Le composant ne garde que l'état et le rendu.
import {
  isQuoteUploadError,
  type QuoteUploadErrorCode,
} from "@/lib/quote-upload-client";

/** Boîte de contact de l'atelier (la même que la page Contact). */
export const QUOTE_CONTACT_EMAIL = "contact@swiss3design.ch";

/** Bornes du schéma de submitQuoteRequest (custom/actions.ts), pour maxLength. */
export const QUOTE_LIMITS = {
  description: 4000,
  descriptionMin: 10,
  colors: 200,
  dimensions: 200,
} as const;

/**
 * Clé du message d'erreur (`quote.errors.<clé>`) pour une erreur levée par
 * l'envoi ou par `attachment.prepare` : le code d'une QuoteUploadError, sinon
 * « unknown » (message générique).
 */
export function uploadErrorKey(
  error: unknown,
): QuoteUploadErrorCode | "unknown" {
  return isQuoteUploadError(error) ? error.code : "unknown";
}

/**
 * Message déjà rédigé pour l'utilisateur par celui qui a levé l'erreur : le
 * tiroir du Studio (export STL, nom, garde d'imprimabilité) sait mieux que le
 * formulaire ce qui s'est passé. Convention : une propriété `userMessage` de
 * type chaîne non vide sur l'objet jeté. null sinon.
 */
export function userMessageOf(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { userMessage?: unknown }).userMessage;
  return typeof message === "string" && message.trim() ? message : null;
}

const MEBIOCTET = 1024 * 1024;

/**
 * « 2,9 Mo » (fr-CH) / « 2.9 MB » (de-CH, it-CH, en-CH) : Intl, jamais à la
 * main (brief §2.2). Mébioctets, comme le plafond de 30 Mo de la route ; en
 * dessous de 100 Kio, en kio (« 4 ko ») pour ne pas afficher « 0 Mo ».
 */
export function formatBytes(bytes: number, locale: string): string {
  const small = bytes < 100 * 1024;
  return new Intl.NumberFormat(`${locale}-CH`, {
    style: "unit",
    unit: small ? "kilobyte" : "megabyte",
    unitDisplay: "short",
    maximumFractionDigits: small ? 0 : 1,
  }).format(small ? bytes / 1024 : bytes / MEBIOCTET);
}

/** « 42 % » selon la locale suisse. */
export function formatPercent(fraction: number, locale: string): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  return new Intl.NumberFormat(`${locale}-CH`, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(clamped);
}

/** Entier avec séparateur de milliers de la locale suisse (« 58 420 »). */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(`${locale}-CH`, {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Nombre d'étapes de l'attente narrée : 3 si le fichier est préparé puis
 * envoyé à la soumission (Studio : « 1/3 Préparation », « 2/3 Envoi »,
 * « 3/3 Enregistrement »), 1 sinon (fichier déjà envoyé, ou pas de fichier).
 */
export function submitSteps(hasPrepare: boolean): 1 | 3 {
  return hasPrepare ? 3 : 1;
}
