"use client";

// Chorégraphie « about » (brief « Strates » §7.11, fiche WP-ABOUT) : à
// l'entrée dans l'écran, le schéma de l'imprimante s'« imprime » de bas en
// haut, couche par couche, puis ses renvois apparaissent. C'est la seule
// animation JS de l'Atelier ; révélations de texte et de cartes restent en CSS
// (.s3d-rise, .s3d-print), et le h1 n'est jamais animé (§3.1, principe 4).
//
// Chargée par src/gates/about.tsx, et seulement quand le runtime tourne
// (mouvement complet, capacité ≥ C1) : en mouvement réduit comme en C0, le
// schéma est déjà dans son état final dans le HTML, sans rien à défaire.
//
// Un plugin à usage unique est enregistré ici, pas dans @/motion/gsap : le
// chunk du runtime reste celui du §4.11 (≤ 65 KiB gzip), DrawSVG ne part que
// avec cette chorégraphie.
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useRef, type RefObject } from "react";
import { readReducedMotion } from "@/lib/motion-bridge/motion-pref";
import { ScrollTrigger, gsap, useGSAP } from "@/motion/gsap";

gsap.registerPlugin(DrawSVGPlugin);

// Douze « couches » de mise en scène, décalées de 40 ms : au plus 12 éléments
// décalés (§3.2). Les tracés d'une même tranche horizontale partent ensemble.
const LAYERS = 12;
const LAYER_STEP = 0.04;
const DRAW_DURATION = 0.7;
// Le schéma est « déjà à l'écran » au montage quand son haut est au-dessus de
// cette fraction de la hauteur de la fenêtre (même repère que le déclencheur).
const ENTER_LINE = 0.82;

/**
 * Anime le schéma du panneau actif (`[role="tabpanel"]` non masqué) de la
 * vitrine `scope`. Tous les panneaux sont dans le HTML (les deux machines sont
 * lisibles sans JS), seul l'actif est affiché.
 *
 * - Au montage : si le schéma est sous la ligne de flottaison, il est masqué
 *   (hors écran, donc sans flash) puis imprimé à l'entrée dans l'écran ; s'il
 *   est déjà visible (arrivée sur l'ancre, grand écran), on ne touche à rien :
 *   un dessin qui s'efface pour se retracer serait un défaut, pas un effet.
 * - Quand `variant` change (le visiteur choisit l'autre imprimante) : le
 *   nouveau schéma s'imprime tout de suite, le geste en est la cause.
 *
 * Les styles posés par GSAP sont retirés en fin d'animation et à chaque
 * démontage (useGSAP les annule) : le schéma retrouve exactement son rendu
 * serveur, et le survol des renvois (React) n'en voit rien.
 */
export function SchematicDraw({
  scope,
  variant,
}: {
  scope: RefObject<HTMLElement | null>;
  variant: string;
}) {
  // Variante du rendu précédent. Comparer à elle (et non à « premier rendu »)
  // garde le bon comportement quand React rejoue l'effet en développement.
  const previous = useRef<string | null>(null);

  useGSAP(
    () => {
      const changed = previous.current !== null && previous.current !== variant;
      previous.current = variant;

      const root = scope.current;
      if (!root || readReducedMotion()) return;
      const svg = root.querySelector<SVGSVGElement>(
        '[role="tabpanel"]:not([hidden]) svg',
      );
      const machine = svg?.querySelector<SVGGElement>("[data-machine]");
      if (!svg || !machine) return;

      const top = svg.getBoundingClientRect().top;
      if (!changed && top < window.innerHeight * ENTER_LINE) return;

      const shapes = Array.from(
        machine.querySelectorAll<SVGGeometryElement>(
          "rect, path, circle, line, polyline",
        ),
      );
      if (shapes.length === 0) return;

      // Tranche de chaque tracé, du bas (0) vers le haut (LAYERS - 1) : la
      // machine pousse comme une pièce, du plateau vers la buse.
      const boxes = shapes.map((el) => el.getBoundingClientRect());
      const floor = Math.max(...boxes.map((box) => box.bottom));
      const span = Math.max(
        1,
        floor - Math.min(...boxes.map((box) => box.top)),
      );
      const layerOf = (index: number) =>
        Math.min(
          LAYERS - 1,
          Math.floor(((floor - boxes[index].bottom) / span) * LAYERS),
        );

      const extras = Array.from(
        svg.querySelectorAll<SVGGElement>(
          ".schematic-leaders, .schematic-dots",
        ),
      );
      const timeline = gsap.timeline({
        paused: true,
        onComplete: () => {
          gsap.set(shapes, {
            clearProps: "strokeDasharray,strokeDashoffset,opacity",
          });
          gsap.set(extras, { clearProps: "opacity" });
        },
      });

      shapes.forEach((el, index) => {
        const at = layerOf(index) * LAYER_STEP;
        // Les pleins (bobines, buse) n'ont pas de trait à tracer : ils
        // apparaissent seulement, dans la même tranche.
        if (getComputedStyle(el).stroke !== "none")
          timeline.fromTo(
            el,
            { drawSVG: "0%" },
            { drawSVG: "100%", duration: DRAW_DURATION, ease: "s3d.pas" },
            at,
          );
        timeline.fromTo(
          el,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: "none" },
          at,
        );
      });
      // Renvois et pastilles une fois la machine presque posée.
      timeline.fromTo(
        extras,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "none" },
        LAYERS * LAYER_STEP + 0.3,
      );

      if (changed) timeline.play();
      else
        ScrollTrigger.create({
          trigger: svg,
          start: `top ${Math.round(ENTER_LINE * 100)}%`,
          once: true,
          onEnter: () => timeline.play(),
        });
    },
    { scope, dependencies: [variant], revertOnUpdate: true },
  );

  return null;
}
