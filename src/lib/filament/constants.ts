// Constantes du stock de filament (« Filaments », 15.10.2026). Sans dépendance :
// lu par le serveur, l'admin et les tests.

export type SpoolType =
  | "bambu_reusable"
  | "bambu_refill"
  | "polymaker_cardboard"
  | "r3d_cardboard"
  | "other";

export const SPOOL_TYPE_LIST: readonly SpoolType[] = [
  "bambu_reusable",
  "bambu_refill",
  "polymaker_cardboard",
  "r3d_cardboard",
  "other",
];

export const SPOOL_TYPE_FR: Record<SpoolType, string> = {
  bambu_reusable: "Bambu, bobine plastique",
  bambu_refill: "Recharge Bambu montée sur support",
  polymaker_cardboard: "Polymaker, carton",
  r3d_cardboard: "R3D, carton",
  other: "Autre",
};

/**
 * Tare par défaut d'un type de bobine, en grammes (réglable par bobine et par
 * type, dans `settings` : `filament.tare.<type>`).
 *  - Bambu, bobine plastique réutilisable : 212 g, pesée par le propriétaire.
 *  - Recharge montée : support (212 g) + mandrin en carton (≈ 25 g, jusqu'à
 *    41 g selon la source) = 237 g, à vérifier en pesant un mandrin vide.
 *  - Polymaker, carton de 1 kg : 140 g (± 7 g, chiffre officiel de sa FAQ).
 *  - R3D, carton : ≈ 150 g, estimation à vérifier à la première bobine vide.
 */
export const DEFAULT_TARES: Record<SpoolType, number> = {
  bambu_reusable: 212,
  bambu_refill: 237,
  polymaker_cardboard: 140,
  r3d_cardboard: 150,
  other: 0,
};

/** Tares encore estimées : l'écran les marque « à vérifier ». */
export const TARE_TO_VERIFY: ReadonlySet<SpoolType> = new Set([
  "bambu_refill",
  "r3d_cardboard",
]);

export const SPOOL_LOCATION_FR = {
  ams_p1s: "AMS (P1S)",
  cfs_k2: "CFS (K2)",
  shelf: "Étagère",
} as const;

export const SPOOL_STATUS_FR = {
  ordered: "Commandée",
  in_stock: "En stock",
  empty: "Vide",
  retired: "Retirée",
} as const;

export const MOVEMENT_KIND_FR = {
  receipt: "Réception",
  consumption: "Consommation",
  weigh: "Pesée",
  adjust: "Ajustement",
  empty: "Bobine vide",
  retire: "Bobine retirée",
} as const;

/** Les derniers grammes d'une bobine ne sont pas imprimables (fin de bobine, purge). */
export const SAFETY_GRAMS = 20;

/** Capacité publique : arrondie à 10 g, plafonnée à 1500 g (jamais le niveau exact). */
export const CAPACITY_STEP_GRAMS = 10;
export const CAPACITY_MAX_GRAMS = 1500;

/**
 * Marge du filtre « couleurs en stock » du formulaire de devis : purge, bordure
 * et premières couches. L'estimation AFFICHÉE au client reste la valeur brute.
 */
export const QUOTE_MARGIN = { factor: 1.15, extraGrams: 15 } as const;

/** Clé du verrou consultatif qui sérialise les contrôles de stock du paiement. */
export const STOCK_LOCK_KEY = 7_300_001;

/** Un devis du formulaire : 1 à 100 pièces, 0 à 4 couleurs. */
export const QUOTE_QUANTITY_MAX = 100;
export const QUOTE_COLORS_MAX = 4;

/** Matière d'une demande de /custom avec fichier : la seule que l'atelier imprime (stock 100 % PLA). */
export const CUSTOM_MATERIAL = "PLA";

/** Tarification Bambu Lab Europe (réglable dans `settings` : `filament.shop`). */
export const BAMBU_SHOP = {
  tiers: [
    { minUnits: 2, percent: 10 },
    { minUnits: 4, percent: 20 },
    { minUnits: 6, percent: 30 },
    { minUnits: 10, percent: 40 },
  ],
  freeShippingEurCents: 11_900,
  shippingEurCents: 2_000,
  defaultSpoolEurCents: 1_999,
  defaultRefillEurCents: 1_699,
  /** Un extra n'est proposé que s'il coûte au plus 50 % de son prix catalogue. */
  maxExtraRatio: 0.5,
} as const;
