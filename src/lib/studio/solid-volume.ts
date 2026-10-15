// Volume imprimé d'un objet plein (brief « Strates », §6.5) : module minuscule et
// sans dépendance, partagé par les statistiques du Studio (stats.ts) et par
// l'estimation du poids d'un fichier de devis (lib/mesh-weight), qui ne doit pas
// embarquer les générateurs de géométrie du Studio.

/** Épaisseur de la coque pleine (mm) et remplissage des objets épais (§6.5). */
export const SHELL_MM = 0.8;
export const INFILL = 0.15;

/**
 * Volume imprimé (mm³) d'un objet plein de plus de 3 mm : coque de 0,8 mm
 * pleine + remplissage à 15 % du reste (`V_coque = min(V, A × 0,8)`).
 */
export function solidPrintVolume(
  volumeMm3: number,
  surfaceMm2: number,
): number {
  const shell = Math.min(volumeMm3, surfaceMm2 * SHELL_MM);
  return shell + INFILL * (volumeMm3 - shell);
}
