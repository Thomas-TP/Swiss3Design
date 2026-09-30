// Formats d'affichage du Studio (brief « Strates », §2.2 « Chiffres » et
// §6.3.2 : `formatMm`, `formatGrams`, `formatDuration`, `formatLayers` via
// `Intl.NumberFormat(`${locale}-CH`)`). Toujours les règles de la Suisse :
// `0,2 mm` en fr-CH, `0.2 mm` en de-CH, it-CH et en-CH, séparateur de
// milliers géré par ICU. Utilisé aussi dans les textes de canvas, donc pur et
// sans React.
//
// Les mots (« couches », « changements ») sont des messages ICU du namespace
// `studioCore` (units.*) : ce fichier ne formate que les nombres et les unités
// universelles (mm, g, min, CHF).

type NumberFormatKey = string;
const cache = new Map<NumberFormatKey, Intl.NumberFormat>();

function numberFormat(
  locale: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  useGrouping = true,
): Intl.NumberFormat {
  const key = `${locale}|${minimumFractionDigits}|${maximumFractionDigits}|${useGrouping}`;
  let nf = cache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(`${locale}-CH`, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    });
    cache.set(key, nf);
  }
  return nf;
}

const NBSP = " ";

/** Nombre à `digits` décimales fixes, selon la locale suisse. */
export function formatNumber(
  value: number,
  locale: string,
  digits = 0,
): string {
  return numberFormat(locale, digits, digits).format(value);
}

/** Entier avec séparateur de milliers (« 58 420 »). */
export function formatInteger(value: number, locale: string): string {
  return numberFormat(locale, 0, 0).format(Math.round(value));
}

/** Millimètres : « 150,0 mm » (une décimale par défaut). */
export function formatMm(mm: number, locale: string, digits = 1): string {
  return `${formatNumber(mm, locale, digits)}${NBSP}mm`;
}

/** Grammes : « 92 g », une décimale sous 10 g (« 4,8 g »). */
export function formatGrams(grams: number, locale: string): string {
  const digits = grams < 10 ? 1 : 0;
  return `${formatNumber(grams, locale, digits)}${NBSP}g`;
}

const HOUR_UNIT: Record<string, string> = { de: "Std." };

/**
 * Durée d'impression : « 2 h 45 » (sous une heure : « 45 min »). Les minutes
 * sont arrondies à l'entier ; le signe « ≈ » appartient à l'interface.
 */
export function formatDuration(minutes: number, locale: string): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}${NBSP}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const unit = HOUR_UNIT[locale] ?? "h";
  return `${formatInteger(h, locale)}${NBSP}${unit}${NBSP}${String(m).padStart(2, "0")}`;
}

/** Durée en secondes : « 1 min 39 » (sous une minute : « 42 s »), sinon comme formatDuration. */
export function formatClock(seconds: number, locale: string): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}${NBSP}s`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    return `${m}${NBSP}min${NBSP}${String(total % 60).padStart(2, "0")}`;
  }
  return formatDuration(total / 60, locale);
}

/** Nombre de couches (« 750 »), séparateur de milliers ICU. */
export function formatLayers(layers: number, locale: string): string {
  return formatInteger(layers, locale);
}

/** Numéro de couche à largeur fixe, sans séparateur : « 0284 » (télémétrie mono). */
export function formatLayerIndex(layer: number, width = 4): string {
  return String(Math.max(0, Math.round(layer))).padStart(width, "0");
}

/** Fourchette de prix en centimes : « CHF 17–23 » ou « CHF 9.00–10.50 » (demi-francs). */
export function formatChfRange(
  lowCents: number,
  highCents: number,
  locale: string,
): string {
  const whole = lowCents % 100 === 0 && highCents % 100 === 0;
  const digits = whole ? 0 : 2;
  const nf = numberFormat(locale, digits, digits);
  return `CHF${NBSP}${nf.format(lowCents / 100)}–${nf.format(highCents / 100)}`;
}

const BYTE_UNITS: Record<string, [string, string]> = {
  fr: ["Ko", "Mo"],
};

/** Taille de fichier : « 2,9 Mo » (fr), « 2.9 MB » (de, it, en). */
export function formatBytes(bytes: number, locale: string): string {
  const [kilo, mega] = BYTE_UNITS[locale] ?? ["KB", "MB"];
  if (bytes < 1_000_000) {
    return `${formatNumber(bytes / 1000, locale, bytes < 10_000 ? 1 : 0)}${NBSP}${kilo}`;
  }
  return `${formatNumber(bytes / 1_000_000, locale, 1)}${NBSP}${mega}`;
}

/** Durée réelle et durée simulée : « 2 h 45 », « à ×100 : 1 min 39 ». */
export function simulatedSeconds(minutes: number, speed: 1 | 10 | 100): number {
  return (minutes * 60) / speed;
}
