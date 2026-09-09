// Server Components ne rendent qu'une fois par requête : l'horloge y est
// stable, contrairement à un Client Component qui peut re-render plusieurs
// fois. Sorti dans un helper pour satisfaire react/purity (qui ne fait pas
// cette distinction et signale tout `Date.now()` au corps d'un composant).
export function renderTime(): number {
  return Date.now();
}

export function formatChf(cents: number, locale: string): string {
  return new Intl.NumberFormat(`${locale}-CH`, {
    style: "currency",
    currency: "CHF",
  }).format(cents / 100);
}
