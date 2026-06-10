export function formatChf(cents: number, locale: string): string {
  return new Intl.NumberFormat(`${locale}-CH`, {
    style: "currency",
    currency: "CHF",
  }).format(cents / 100);
}
