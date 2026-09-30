import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

// Les trois familles du site, déclarées une seule fois (chaque appel d'un
// loader next/font crée une instance hébergée à part) et importées par le
// layout racine, qui les précharge sur toutes les routes. next/font recopie les
// fichiers dans /_next/static/media au build : servis en static assets
// Cloudflare (hors bundle du Worker, règle d'or 10) et same-origin
// (font-src 'self', aucune requête vers Google depuis le navigateur).

// Interface et texte : Geist, inchangée (aussi chargée dans les iframes Stripe
// par checkout-flow.tsx et stripe-appearance.ts : même famille des deux côtés).
export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

// Télémétrie mono : jamais un élément LCP, donc pas de préchargement.
//
// adjustFontFallback désactivé : next/font calcule le repli contre Arial
// (size-adjust 134,59 %), donc une police À CHASSE VARIABLE. Or Geist Mono est
// à chasse fixe (0,6 em par caractère) : avant l'arrivée du fichier, un libellé
// en capitales et chiffres était environ 25 % plus large (0 : 74,9 px contre
// 60 px à 100 px de corps, W : 127 contre 60, i : 30 contre 60), puis se
// rétrécissait d'un coup au remplacement (la barre de l'Atelier passait de 311
// à 230 px, décalage de mise en page de 0,04 à 0,1). Le repli est déclaré à la
// main dans globals.css (« S3D Mono Fallback », Courier New et équivalents,
// eux aussi à 0,6 em) : mêmes largeurs, le remplacement ne déplace plus rien.
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

// Titres : Archivo, largeur figée à 112,5 (SemiExpanded), graisse variable
// 500–900. 35 Ko au lieu de 88 Ko pour l'axe wdth complet. Source Google Fonts
// (OFL, licence dans src/fonts/OFL-Archivo.txt), recopiée telle quelle :
// https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112.5,500..900
// (bloc « latin », v25). L'axe wdth n'existe plus dans ce fichier : jamais
// animer font-stretch ou font-variation-settings sur le h1 (LCP).
export const archivo = localFont({
  src: "../fonts/archivo-sx-latin.woff2",
  weight: "500 900",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
  preload: true,
  fallback: ["Arial", "Helvetica", "sans-serif"],
  adjustFontFallback: "Arial",
});
