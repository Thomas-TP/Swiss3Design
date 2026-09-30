"use client";

// Chorégraphie de la fiche produit (brief « Strates », §3.3, §9.3 WP-SHOP) :
// les titres de chapitre (02 à 07) se révèlent ligne par ligne, « couche par
// couche » : SplitText `lines` masquées, chaque ligne monte de 100 % avec un
// décalage de 40 ms, `s3d.strate` 0,8 s, UNE fois à l'entrée dans l'écran.
//
// Ce que la règle « le mouvement ne retient jamais le contenu » impose :
// - le texte est dans le HTML SSR, complet, dès le premier paint ; SplitText
//   n'arrive qu'après l'hydratation et le runtime, ne fait que le rejouer ;
// - jamais sur le h1 (LCP), jamais sur un élément au-dessus de la ligne de
//   flottaison au chargement : le chapitre 01 n'a d'ailleurs pas de h2 ;
// - SplitText pose `aria-label` sur le parent et `aria-hidden` sur les
//   fragments : un lecteur d'écran lit le titre d'un seul tenant ;
// - monté seulement en mouvement complet (ProductMotion) : en mouvement réduit,
//   ou si l'interrupteur du footer est actionné en cours de visite, le
//   démontage remet le DOM d'origine (titres dans leur état final).
//
// SplitText est propre à cette chorégraphie : il part dans son chunk, chargé par
// le gate de la fiche, jamais dans le runtime partagé (src/motion/gsap.ts).
import { SplitText } from "gsap/SplitText";
import { gsap, useGSAP } from "../gsap";

gsap.registerPlugin(SplitText);

// Un titre de chapitre = le h2 du <header> d'un <section data-chapter>.
const CHAPTER_TITLES = "section[data-chapter] > header h2";

export function ProductChoreo() {
  useGSAP(() => {
    const titles = gsap.utils.toArray<HTMLElement>(CHAPTER_TITLES);
    for (const title of titles) {
      SplitText.create(title, {
        type: "lines",
        mask: "lines",
        // Re-découpe si la largeur ou les polices changent (allemand, rotation
        // de l'écran) ; l'animation retournée garde sa progression.
        autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 100,
            duration: 0.8,
            ease: "s3d.strate",
            stagger: 0.04,
            scrollTrigger: { trigger: title, start: "top 88%", once: true },
          });
        },
      });
    }
  }, []);

  return null;
}
