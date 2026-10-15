// Coûts du stock (calcul PUR, testé dans costs.test.ts) : coût moyen au kilo
// RÉEL (achats), valeur du stock, consommation par mois. Tout en centimes CHF.

export interface CostSpool {
  id: string;
  costCents: number | null;
  initialGrams: number;
  remainingGrams: number;
  status: "ordered" | "in_stock" | "empty" | "retired";
}

export interface CostConsumption {
  spoolId: string;
  /** Grammes consommés, positifs. */
  grams: number;
  at: Date;
}

export interface MonthlyConsumption {
  /** `AAAA-MM`. */
  month: string;
  grams: number;
  costCents: number;
}

export interface CostSummary {
  /** Coût moyen au kilo des bobines dont le prix est connu ; null sans achat chiffré. */
  avgCentsPerKg: number | null;
  /** Valeur du stock restant au coût de chaque bobine. */
  stockValueCents: number;
  /** Bobines en stock sans prix : leur valeur n'est pas comptée. */
  stockWithoutCost: number;
  monthly: MonthlyConsumption[];
}

export function summarizeCosts(
  spools: readonly CostSpool[],
  consumptions: readonly CostConsumption[],
): CostSummary {
  const priced = spools.filter(
    (s) => s.costCents !== null && s.status !== "ordered",
  );
  const paidCents = priced.reduce((s, x) => s + (x.costCents ?? 0), 0);
  const paidGrams = priced.reduce((s, x) => s + x.initialGrams, 0);
  const perGram = new Map(
    priced.map((s) => [s.id, (s.costCents ?? 0) / s.initialGrams]),
  );
  const inStock = spools.filter((s) => s.status === "in_stock");
  const stockValueCents = Math.round(
    inStock.reduce(
      (sum, s) => sum + s.remainingGrams * (perGram.get(s.id) ?? 0),
      0,
    ),
  );
  const months = new Map<string, MonthlyConsumption>();
  for (const c of consumptions) {
    const month = `${c.at.getUTCFullYear()}-${String(c.at.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = months.get(month) ?? { month, grams: 0, costCents: 0 };
    entry.grams += c.grams;
    entry.costCents += c.grams * (perGram.get(c.spoolId) ?? 0);
    months.set(month, entry);
  }
  return {
    avgCentsPerKg:
      paidGrams > 0 ? Math.round((paidCents / paidGrams) * 1000) : null,
    stockValueCents,
    stockWithoutCost: inStock.filter((s) => s.costCents === null).length,
    monthly: [...months.values()]
      .map((m) => ({ ...m, costCents: Math.round(m.costCents) }))
      .sort((a, b) => b.month.localeCompare(a.month)),
  };
}
