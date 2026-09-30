import type { Locale } from "@/i18n/routing";

// Crédits de conception des modèles que l'atelier imprime TELS QUELS (brief de
// refonte « Strates », §1.5 point 2 et §7.9). Le Vase spirale est le modèle de
// Ian (MakerWorld), publié sous Creative Commons BY-ND 4.0 : vendre des
// impressions est permis, à deux conditions que ce fichier et ses consommateurs
// tiennent ensemble :
//   - l'attribution est obligatoire (nom, licence, lien) : AttributionBlock la
//     rend côté serveur dans les 4 langues, productJsonLd la déclare en données
//     structurées (nœud 3DModel), la planche de la boutique en porte une ligne ;
//   - aucune œuvre dérivée : `modified` reste faux. Ni changement de géométrie,
//     de taille ou de motif, ni coupe, ni shader d'impression, ni teinte non
//     vendue dans le viewer, et jamais le modèle dans le Studio.
//
// Données, pas du texte d'interface : les phrases sont traduites dans
// messages/<locale>/catalog.json (namespace `catalog`). Un slug absent d'ici
// est un produit de notre conception : aucune mention n'est rendue.

export interface Attribution {
  /** Titre du modèle chez son auteur (« Vase »), pas le nom de notre fiche. */
  title: string;
  author: string;
  platform: string;
  /** Page du modèle chez l'auteur (lien exigé par l'attribution). */
  url: string;
  license: string;
  /** Racine de la licence, avec « / » final (le deed localisé s'y accole). */
  licenseUrl: string;
  /** Vrai dès qu'on change quoi que ce soit au fichier : interdit en BY-ND. */
  modified: boolean;
}

const ATTRIBUTIONS: ReadonlyMap<string, Attribution> = new Map([
  [
    "vase-spirale",
    {
      title: "Vase",
      author: "Ian",
      platform: "MakerWorld",
      url: "https://makerworld.com/fr/models/1262112-vase",
      license: "CC BY-ND 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/",
      modified: false,
    },
  ],
]);

/** Crédit de conception d'un produit, ou null si le modèle est de nous. */
export function attributionFor(slug: string): Attribution | null {
  return ATTRIBUTIONS.get(slug) ?? null;
}

/** Deed Creative Commons dans la langue de la page (…/by-nd/4.0/deed.fr). */
export function licenseDeedUrl(
  attribution: Pick<Attribution, "licenseUrl">,
  locale: Locale,
): string {
  return `${attribution.licenseUrl}deed.${locale}`;
}
