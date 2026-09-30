// Dimensions et points d'ancrage des posters de champ de courbes
// (`public/posters/field-*-{light,dark}.svg`, générés par
// `scripts/gen-field-posters.ts`). Module LÉGER, sans dépendance : les pages
// (404, Contact) le lisent pour poser leurs points rouges au bon endroit, le
// générateur s'en sert pour construire le relief autour.
//
// Coordonnées `u` et `v` : fraction (0–1) de la largeur et de la hauteur du
// viewBox, `v` vers le bas. Les SVG sont en `preserveAspectRatio="xMidYMid
// slice"` : pour que « u = 0,64 » tombe au même endroit à l'écran, posez le
// poster et le point dans un conteneur qui a LE RAPPORT du viewBox
// (`aspect-[1200/720]`, etc.) et placez le point en `left: u × 100 %` et
// `top: v × 100 %`.

export type FieldId = "footer" | "404" | "leman" | "home";

/** viewBox de chaque poster (unités arbitraires ; seul le rapport compte). */
export const FIELD_SIZES: Record<FieldId, { width: number; height: number }> = {
  footer: { width: 600, height: 420 },
  "404": { width: 1200, height: 720 },
  leman: { width: 800, height: 520 },
  home: { width: 600, height: 1000 },
};

export interface FieldPoint {
  u: number;
  v: number;
}

export const FIELD_ANCHORS = {
  /** « Vous êtes ici » : le sommet non coté de la 404 (altitude 404 m). */
  "404": { here: { u: 0.64, v: 0.44 } },
  /**
   * Gland et Pully sur la rive nord du lac (villes seulement, jamais d'adresse de
   * rue) : Gland à l'ouest, Pully plus à l'est et plus au nord.
   */
  leman: {
    gland: { u: 0.25, v: 0.6368 },
    pully: { u: 0.58, v: 0.4748 },
  },
} as const satisfies Partial<Record<FieldId, Record<string, FieldPoint>>>;
