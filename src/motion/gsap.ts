// src/motion/gsap.ts — seul module qui importe les paquets gsap (brief
// « Strates », §3.2). Tout src/motion importe d'ici : les plugins sont
// enregistrés une fois, les courbes de la marque existent partout sous le même
// nom, et un plugin rare (DrawSVGPlugin des schémas de l'Atelier) s'enregistre
// dans la chorégraphie qui l'utilise, jamais ici.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, CustomEase);

// Mêmes courbes que les jetons CSS --ease-* de globals.css (§2.5, §3.2).
CustomEase.create("s3d.strate", "M0,0 C0.16,0.84 0.3,1 1,1");
CustomEase.create("s3d.buse", "M0,0 C0.45,0 0.55,1 1,1");
CustomEase.create("s3d.purge", "M0,0 C0.3,1.35 0.6,1 1,1");
CustomEase.create("s3d.carte", "M0,0 C0.7,0 0.2,1 1,1");

/** Ease quantifiée : avance par paliers de 1/n (une « couche »), adoucie par k. Monotone. */
export function pas(n = 12, k = 0.85) {
  return (p: number) => p + (Math.round(p * n) / n - p) * k;
}
gsap.registerEase("s3d.pas", pas(12));

gsap.defaults({ ease: "s3d.strate", duration: 0.8 });
// La barre d'adresse mobile qui apparaît ou disparaît ne relance pas tous
// les calculs de ScrollTrigger (hauteurs mobiles en svh, §3.3).
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText, Flip, CustomEase, useGSAP };
