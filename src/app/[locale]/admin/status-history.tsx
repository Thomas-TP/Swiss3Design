interface StatusHistoryEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  source: string;
  createdAt: Date;
}

const SOURCE_LABELS: Record<string, string> = {
  checkout: "Checkout",
  payment: "Paiement Stripe",
  admin: "Administration",
  customer: "Client",
  system: "Maintenance",
};

export function StatusHistory({
  events,
  statusLabels,
}: {
  events: StatusHistoryEvent[];
  statusLabels: Record<string, string>;
}) {
  if (events.length === 0) return null;
  const label = (status: string | null) =>
    status ? (statusLabels[status] ?? status) : "Création";
  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-5">
      <h3 className="mb-3 font-semibold">Historique des statuts</h3>
      <ol className="space-y-3 text-sm">
        {events.map((event) => (
          <li key={event.id} className="border-l-2 border-line pl-3">
            <p className="font-medium">
              {label(event.fromStatus)} → {label(event.toStatus)}
            </p>
            <p className="text-xs text-soft">
              {event.createdAt.toLocaleString("fr-CH")} ·{" "}
              {SOURCE_LABELS[event.source] ?? event.source}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-soft">
        Journal append-only disponible depuis l’activation de cette version.
      </p>
    </section>
  );
}
