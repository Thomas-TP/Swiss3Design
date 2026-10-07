// src/motion/gsap.ts — socle GSAP de src/motion (brief « Strates », §3.2).
// Tout src/motion importe gsap, ScrollTrigger et useGSAP d'ici : le cœur est
// enregistré une fois, les courbes de la marque existent partout sous le même
// nom. N'y entre que ce que le runtime de WP-00 utilise : ce module fait
// partie du chunk runtime (≤ 65 KiB gzip avec Lenis, §4.11).
//
// Un plugin d'une chorégraphie s'importe et s'enregistre dans la chorégraphie
// qui s'en sert, jamais ici : SplitText (titres de chapitre), Flip (boutique,
// Studio), DrawSVGPlugin (schémas de l'Atelier). Il part alors dans le chunk
// de cette chorégraphie, chargé par son propre gate :
//
//   import { SplitText } from "gsap/SplitText";
//   import { gsap } from "@/motion/gsap";
//   gsap.registerPlugin(SplitText); // idempotent
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);

// Mêmes courbes que les jetons CSS --ease-* de globals.css (§2.5, §3.2).
CustomEase.create("s3d.strate", "M0,0 C0.16,0.84 0.3,1 1,1");
CustomEase.create("s3d.buse", "M0,0 C0.45,0 0.55,1 1,1");
CustomEase.create("s3d.purge", "M0,0 C0.3,1.35 0.6,1 1,1");
CustomEase.create("s3d.carte", "M0,0 C0.7,0 0.2,1 1,1");

/** Ease quantifiée : avance par paliers de 1/n (une « couche »), adoucie par k. Monotone.
 *  Plus aucune animation du site ne l'utilise (07.10.2026) : conservée pour
 *  d'éventuels tests, jamais pour un mouvement visible. */
export function pas(n = 12, k = 0.85) {
  return (p: number) => p + (Math.round(p * n) / n - p) * k;
}
// Le propriétaire n'accepte aucune animation par paliers (retours R06/R07,
// 07.10.2026) : l'ancien nom « s3d.pas » reste enregistré, car les
// chorégraphies qui l'appellent encore ne doivent pas planter, mais il
// désigne désormais la courbe continue s3d.strate. Les appelants passeront à
// « s3d.strate » à leur prochaine retouche.
gsap.registerEase("s3d.pas", gsap.parseEase("s3d.strate"));

gsap.defaults({ ease: "s3d.strate", duration: 0.8 });
// La barre d'adresse mobile qui apparaît ou disparaît ne relance pas tous
// les calculs de ScrollTrigger (hauteurs mobiles en svh, §3.3).
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, CustomEase, useGSAP };
