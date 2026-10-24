// Projet Bambu Studio du 3MF de l'atelier : ce qui fait qu'à l'ouverture, Bambu
// Studio crée lui-même les filaments du devis (nombre, couleurs, profils) au lieu
// de garder ceux du projet ouvert. Un 3MF « d'un autre logiciel » n'apporte que
// la géométrie et la peinture, et la peinture d'un filament absent du projet est
// perdue au chargement (constaté le 24.10.2026 : 3e couleur d'un cube disparue,
// même après ajout d'un filament).
//
// La configuration vient de bambu-template.json (scripts/bambu/
// build-project-template.ts, depuis les profils de Bambu Studio : P1S, buse 0.4,
// « 0.20mm Standard @BBL X1C ») : une partie commune, et les réglages de chaque
// profil de filament du stock, concaténés ici dans l'ordre des filaments, comme
// l'interface de Bambu Studio les enregistre.

/** Un filament du projet : sa teinte et le profil Bambu Studio qui l'imprime. */
export interface BambuFilament {
  /** « #RRGGBB ». */
  hex: string;
  /** Nom d'un profil de bambu-template.json (voir bambuPresetFor). */
  preset: string;
}

export interface BambuTemplate {
  /** « BambuStudio-02.08.04.57 » : la version qui a fourni les profils. */
  application: string;
  shared: Record<string, unknown>;
  /** Clés propres à chaque filament (tableaux concaténés). */
  perFilament: string[];
  presets: Record<string, Record<string, unknown[]>>;
}

/** Profil par défaut : celui d'un PLA sans profil dédié. */
export const GENERIC_PRESET = "Generic PLA";

/**
 * Profil Bambu Studio d'une référence du stock, d'après sa marque et sa gamme
 * (`filament_refs`). Les gammes Bambu Lab ont leur profil ; Polymaker PolyTerra
 * aussi ; une soie d'une autre marque prend « Generic PLA Silk », le reste
 * « Generic PLA ».
 */
export function bambuPresetFor(brand: string, range: string): string {
  const b = brand.toLowerCase();
  const r = range.toLowerCase();
  if (b.startsWith("bambu")) {
    if (r.includes("matte")) return "Bambu PLA Matte @BBL X1C";
    if (r.includes("metal")) return "Bambu PLA Metal @BBL X1C";
    if (r.includes("silk")) return "Bambu PLA Silk @BBL X1C";
    if (r.includes("wood")) return "Bambu PLA Wood @BBL X1C";
    return "Bambu PLA Basic @BBL X1C";
  }
  if (b.includes("polymaker") && r.includes("polyterra"))
    return "PolyTerra PLA @BBL X1C";
  if (r.includes("silk")) return "Generic PLA Silk";
  return GENERIC_PRESET;
}

/** Teinte au format de Bambu Studio (« #RRGGBB » en majuscules). */
function bambuHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? `#${m[1].toUpperCase()}` : "#FFFFFF";
}

/**
 * `Metadata/project_settings.config` pour ces filaments : la partie commune,
 * puis chaque clé propre aux filaments concaténée profil après profil. Les
 * tableaux qui dépendent du nombre de filaments sans être des réglages de
 * profil (index, carte des buses, purge) sont reconstruits à la taille.
 */
export function projectSettings(
  template: BambuTemplate,
  filaments: readonly BambuFilament[],
): Record<string, unknown> {
  const n = filaments.length;
  const config: Record<string, unknown> = structuredClone(template.shared);
  const presetOf = (f: BambuFilament) =>
    template.presets[f.preset] ?? template.presets[GENERIC_PRESET];
  for (const key of template.perFilament)
    config[key] = filaments.flatMap((f) => presetOf(f)[key] ?? []);
  const hexes = filaments.map((f) => bambuHex(f.hex));
  const repeat = (value: string, count: number) =>
    Array.from({ length: count }, () => value);
  config.filament_colour = hexes;
  config.filament_multi_colour = hexes;
  config.filament_colour_type = repeat("1", n);
  config.filament_self_index = filaments.map((_, i) => String(i + 1));
  config.filament_map = repeat("1", n);
  config.filament_nozzle_map = repeat("1", n);
  config.filament_volume_map = repeat("0", n);
  // [process, filament 1…n, printer] : rien de modifié par rapport aux profils.
  config.different_settings_to_system = repeat("", n + 2);
  config.inherits_group = repeat("", n + 2);
  // Purge : la valeur par défaut de Bambu Studio entre deux filaments
  // différents (« Volumes de purge » > Auto les recalcule d'après les teintes).
  const flush = template.shared.flush_volumes_matrix;
  const between = Array.isArray(flush) && flush[1] ? String(flush[1]) : "280";
  config.flush_volumes_matrix = Array.from({ length: n * n }, (_, i) =>
    Math.floor(i / n) === i % n ? "0" : between,
  );
  const vector = template.shared.flush_volumes_vector;
  config.flush_volumes_vector = repeat(
    Array.isArray(vector) && vector[0] ? String(vector[0]) : "140",
    2 * n,
  );
  return config;
}
