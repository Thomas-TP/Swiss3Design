export function formatChf(cents: number, locale: string): string {
  return new Intl.NumberFormat(`${locale}-CH`, {
    style: "currency",
    currency: "CHF",
  }).format(cents / 100);
}

// Medusa exprime les montants en unité décimale (ex. 29.90), pas en centimes
// comme l'ancienne base D1 — à ne pas confondre avec formatChf() ci-dessus.
export function formatChfAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(`${locale}-CH`, {
    style: "currency",
    currency: "CHF",
  }).format(amount);
}
