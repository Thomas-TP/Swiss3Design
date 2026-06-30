// Les 26 cantons suisses (code à 2 lettres + nom), partagés entre le
// checkout et le carnet d'adresses du compte.
export const CANTONS: [string, string][] = [
  ["AG", "Aargau"],
  ["AI", "Appenzell Rh.-Int."],
  ["AR", "Appenzell Rh.-Ext."],
  ["BE", "Bern"],
  ["BL", "Basel-Landschaft"],
  ["BS", "Basel-Stadt"],
  ["FR", "Fribourg"],
  ["GE", "Genève"],
  ["GL", "Glarus"],
  ["GR", "Graubünden"],
  ["JU", "Jura"],
  ["LU", "Luzern"],
  ["NE", "Neuchâtel"],
  ["NW", "Nidwalden"],
  ["OW", "Obwalden"],
  ["SG", "St. Gallen"],
  ["SH", "Schaffhausen"],
  ["SO", "Solothurn"],
  ["SZ", "Schwyz"],
  ["TG", "Thurgau"],
  ["TI", "Ticino"],
  ["UR", "Uri"],
  ["VD", "Vaud"],
  ["VS", "Valais"],
  ["ZG", "Zug"],
  ["ZH", "Zürich"],
];

export const CANTON_CODES = new Set(CANTONS.map(([code]) => code));
