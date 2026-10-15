// Calculs PURS du stock (sans base) : restant d'une pesée, disponible par
// référence, capacité publique, besoin d'un devis. Testés dans availability.test.ts.
import {
  CAPACITY_MAX_GRAMS,
  CAPACITY_STEP_GRAMS,
  QUOTE_MARGIN,
  SAFETY_GRAMS,
} from "./constants";

/** Pesée : restant = poids brut lu sur la balance − tare de la bobine, jamais négatif. */
export function remainingFromGross(grossGrams: number, tareGrams: number) {
  return Math.max(0, Math.round(grossGrams) - Math.round(tareGrams));
}

export interface AvailabilityRef {
  id: string;
  /** Id de la palette du Studio (`blanc-neve`…), ou null. */
  studioId: string | null;
}

export interface AvailabilitySpool {
  refId: string;
  status: "ordered" | "in_stock" | "empty" | "retired";
  remainingGrams: number;
  initialGrams: number;
  sealed: boolean;
}

export interface Reservations {
  /** Grammes réservés par id de palette du Studio (commandes). */
  studio: Readonly<Record<string, number>>;
  /** Grammes réservés par id de référence (devis acceptés). */
  quote: Readonly<Record<string, number>>;
}

export interface RefAvailability {
  refId: string;
  /** Somme des restants des bobines en stock (commandées exclues). */
  remaining: number;
  reserved: number;
  /** restant − réservé (peut être négatif : à voir dans l'admin). */
  available: number;
  /** Bobines neuves non ouvertes en stock. */
  sealedCount: number;
  /** Bobines commandées, pas encore reçues. */
  orderedCount: number;
  orderedGrams: number;
}

export function computeAvailability(
  refs: readonly AvailabilityRef[],
  spools: readonly AvailabilitySpool[],
  reservations: Reservations,
): Map<string, RefAvailability> {
  const out = new Map<string, RefAvailability>();
  for (const ref of refs) {
    const mine = spools.filter((s) => s.refId === ref.id);
    const stock = mine.filter((s) => s.status === "in_stock");
    const ordered = mine.filter((s) => s.status === "ordered");
    const remaining = stock.reduce((sum, s) => sum + s.remainingGrams, 0);
    const reserved =
      (ref.studioId ? (reservations.studio[ref.studioId] ?? 0) : 0) +
      (reservations.quote[ref.id] ?? 0);
    out.set(ref.id, {
      refId: ref.id,
      remaining,
      reserved,
      available: remaining - reserved,
      sealedCount: stock.filter((s) => s.sealed).length,
      orderedCount: ordered.length,
      orderedGrams: ordered.reduce((sum, s) => sum + s.initialGrams, 0),
    });
  }
  return out;
}

/** Une couleur couvre un besoin si le disponible, moins la réserve de fin de bobine, le suffit. */
export function covers(availableGrams: number, needGrams: number): boolean {
  return needGrams <= availableGrams - SAFETY_GRAMS;
}

/**
 * Capacité exposée au public : ce que l'atelier peut engager, arrondi À LA BAISSE
 * à 10 g et plafonné à 1500 g. Jamais le niveau exact du stock.
 */
export function publicCapacity(availableGrams: number): number {
  const usable = Math.max(0, availableGrams - SAFETY_GRAMS);
  const stepped =
    Math.floor(usable / CAPACITY_STEP_GRAMS) * CAPACITY_STEP_GRAMS;
  return Math.min(stepped, CAPACITY_MAX_GRAMS);
}

/** Besoin de filament d'un devis pour le filtre des couleurs : estimation × quantité × 1,15 + 15 g. */
export function quoteNeedGrams(
  gramsPerPiece: number,
  quantity: number,
): number {
  return Math.ceil(
    gramsPerPiece * Math.max(1, quantity) * QUOTE_MARGIN.factor +
      QUOTE_MARGIN.extraGrams,
  );
}
