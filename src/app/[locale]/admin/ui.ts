// Constantes partagées du back-office (français uniquement)

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const ORDER_STATUS_FR: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  in_production: "En production",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const QUOTE_STATUSES = [
  "received",
  "quoted",
  "accepted",
  "paid",
  "in_production",
  "done",
  "rejected",
] as const;

export const QUOTE_STATUS_FR: Record<string, string> = {
  received: "Reçue",
  quoted: "Devis envoyé",
  accepted: "Acceptée",
  paid: "Payée",
  in_production: "En production",
  done: "Terminée",
  rejected: "Refusée",
};

export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  in_production: "bg-blue-50 text-blue-700",
  shipped: "bg-violet-50 text-violet-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
  received: "bg-amber-50 text-amber-700",
  quoted: "bg-blue-50 text-blue-700",
  accepted: "bg-emerald-50 text-emerald-700",
  done: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};

export const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60";

export const BTN_GHOST =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-soft transition-colors hover:border-ink hover:text-ink";
