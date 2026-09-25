// Les états de fabrication ne servent jamais de verrou d'encaissement.
export const paidOrderStates = [
  "paid",
  "in_production",
  "shipped",
  "delivered",
] as const;
export function isOrderPaid(status: string, paidAt?: Date | null) {
  return !!paidAt || (paidOrderStates as readonly string[]).includes(status);
}
export function canTransitionOrder(from: string, to: string) {
  if (from === to) return true;
  const next: Record<string, string[]> = {
    pending: [],
    paid: ["in_production", "shipped", "cancelled"],
    in_production: ["shipped", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
  };
  return next[from]?.includes(to) ?? false;
}
export interface PaymentProof {
  id: string;
  amount: number;
  currency: string;
  offerVersion?: number;
}
export function verifyPayment(
  proof: PaymentProof,
  amount: number,
  existingId?: string | null,
) {
  if (
    proof.currency !== "chf" ||
    proof.amount !== amount ||
    (existingId && existingId !== proof.id)
  )
    throw new Error("payment_mismatch");
}
export function aggregateStock<
  T extends {
    productId: string | null;
    variantId?: string | null;
    quantity: number;
  },
>(lines: T[]) {
  const entries = new Map<string, T>();
  for (const line of lines) {
    if (!line.productId && !line.variantId) continue;
    const key = line.variantId ? "v:" + line.variantId : "p:" + line.productId;
    const prev = entries.get(key);
    entries.set(key, {
      ...line,
      quantity: (prev?.quantity ?? 0) + line.quantity,
    });
  }
  return [...entries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, line]) => line);
}
