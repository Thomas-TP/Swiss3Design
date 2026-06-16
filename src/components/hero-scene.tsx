"use client";

// Hero « impression en cours » — 100 % CSS + Motion, zéro dépendance lourde.
// Cadre d'imprimante (montants + portique) qui dépose une pièce vase couche par
// couche, en boucle. POINT CLÉ : le sommet du masque d'impression ET la position
// verticale de la buse sont dérivés d'UNE SEULE valeur (`reveal`) → la pointe
// suit exactement le sommet imprimé, image par image, sans dérive possible. La
// tête balaie de gauche à droite pendant le dépôt. Couleurs de marque (rouge +
// neutres thémés), respecte prefers-reduced-motion.

import { useEffect } from "react";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
  animate,
} from "motion/react";

// Profil du vase : largeur relative (0–1) de chaque couche, base → col → lèvre.
const PROFILE = [
  0.46, 0.55, 0.64, 0.73, 0.81, 0.87, 0.91, 0.93, 0.92, 0.88, 0.81, 0.72,
  0.63, 0.56, 0.53, 0.57, 0.65, 0.72,
];

const SCENE_W = 280;
const SCENE_H = 340;
const MAX_D = 196; // diamètre max d'une couche (px)
const LAYER_H = 15; // hauteur d'une couche (px)
const OVERLAP = 5; // chevauchement vertical (px)
const BASE_Y = 296; // ligne du plateau (px depuis le haut de la scène)

const stackH = LAYER_H + (PROFILE.length - 1) * (LAYER_H - OVERLAP);
const TOP_Y = BASE_Y - stackH; // sommet de la pièce

// Géométrie de la tête : distance (px) du haut du portique à la pointe de la
// buse = carriage + buse. Cale la pointe pile sur le sommet imprimé.
const CARRIAGE_H = 20;
const NOZZLE_H = 10;
const NOZZLE_TIP = CARRIAGE_H + NOZZLE_H;
const HEAD_SWING = 22; // amplitude du balayage gauche-droite de la tête (px)

const CYCLE = 5.6; // durée d'un cycle d'impression (s)

export function HeroScene({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // Une seule valeur pilote la géométrie : reveal ∈ [0,1] = fraction imprimée.
  // clip (sommet du masque) et translateY de la buse en dérivent ⇒ toujours
  // synchrones. Le sommet imprimé est à TOP_Y + (1−reveal)·stackH, exactement
  // comme la pointe de la buse.
  const reveal = useMotionValue(0);
  const objOpacity = useMotionValue(1);
  const headX = useMotionValue(0);

  const clip = useTransform(reveal, (v) => `inset(${(1 - v) * 100}% 0 0 0)`);
  const gantryY = useTransform(reveal, (v) => (1 - v) * stackH);

  useEffect(() => {
    if (reduce) {
      reveal.set(1);
      objOpacity.set(1);
      headX.set(0);
      return;
    }
    // Dépôt [0→0.5] · maintien [0.5→0.78] · fondu [0.78→0.9] · retour buse [0.92→1]
    const a1 = animate(reveal, [0, 1, 1, 1, 0], {
      duration: CYCLE,
      times: [0, 0.5, 0.78, 0.92, 1],
      ease: ["easeInOut", "linear", "linear", "easeInOut"],
      repeat: Infinity,
    });
    const a2 = animate(objOpacity, [1, 1, 1, 0, 0], {
      duration: CYCLE,
      times: [0, 0.5, 0.78, 0.9, 1],
      ease: "linear",
      repeat: Infinity,
    });
    // Balayage X seulement pendant le dépôt (≈ [0,0.5]), puis tête immobile.
    const a3 = animate(
      headX,
      [0, -HEAD_SWING, HEAD_SWING, -HEAD_SWING, HEAD_SWING, 0, 0, 0],
      {
        duration: CYCLE,
        times: [0, 0.09, 0.19, 0.29, 0.4, 0.5, 0.92, 1],
        ease: "easeInOut",
        repeat: Infinity,
      },
    );
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [reduce, reveal, objOpacity, headX]);

  return (
    <div className={className} aria-hidden style={{ perspective: 1100 }}>
      <div
        className="relative mx-auto md:scale-110 lg:scale-[1.2]"
        style={{ width: SCENE_W, height: SCENE_H }}
      >
        {/* Lueur d'accent derrière la scène */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl" />

        {/* Scène (léger flottement vertical) */}
        <motion.div
          className="absolute inset-0 text-ink"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={
            reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {/* Cadre de l'imprimante : montants latéraux */}
          {[40, SCENE_W - 46].map((x) => (
            <div
              key={x}
              className="absolute rounded-full bg-ink/10"
              style={{ left: x, top: TOP_Y - 26, width: 6, height: BASE_Y - TOP_Y + 34 }}
            />
          ))}

          {/* Plateau d'impression + grille */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-[50%] border border-ink/15 bg-ink/[0.04]"
            style={{
              top: BASE_Y - 10,
              width: MAX_D + 56,
              height: 40,
              backgroundImage:
                "repeating-linear-gradient(90deg, color-mix(in srgb, currentColor 9%, transparent) 0 1px, transparent 1px 18px)",
            }}
          />
          {/* Ombre de contact */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-ink/20 blur-md"
            style={{ top: BASE_Y + 6, width: MAX_D, height: 22, opacity: 0.5 }}
          />

          {/* La pièce, révélée couche par couche (masque dérivé de reveal) */}
          <motion.div
            className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
            style={{ top: TOP_Y, willChange: "clip-path", clipPath: clip, opacity: objOpacity }}
          >
            {PROFILE.map((_, idx) => {
              // idx 0 = sommet (lèvre), dernier = base : dessin du haut vers le
              // bas pour un chevauchement correct en vue plongeante.
              const top = PROFILE.length - 1 - idx;
              const isLip = top === PROFILE.length - 1;
              const width = PROFILE[top] * MAX_D;
              return (
                <div
                  key={top}
                  className="relative"
                  style={{
                    width,
                    height: LAYER_H,
                    marginTop: idx === 0 ? 0 : -OVERLAP,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(to bottom, color-mix(in srgb, var(--color-accent) 78%, white) 0%, var(--color-accent) 42%, var(--color-accent-dark) 100%)",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.18)",
                  }}
                >
                  {isLip && (
                    <span
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
                      style={{
                        width: width * 0.62,
                        height: LAYER_H * 0.62,
                        background: "var(--color-accent-dark)",
                        boxShadow: "inset 0 2px 3px rgba(0,0,0,0.45)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* Portique : translateY dérivé de reveal → pointe pile au sommet imprimé */}
          <motion.div
            className="absolute left-0"
            style={{ top: TOP_Y - NOZZLE_TIP, width: SCENE_W, height: NOZZLE_TIP + 14, y: gantryY }}
          >
            {/* Rail horizontal (le long duquel la tête balaie) */}
            <div
              className="absolute rounded-full bg-ink/25"
              style={{ left: 36, right: 42, top: 6, height: 5 }}
            />
            {/* Conteneur centré (statique) ; la tête balaie en X à l'intérieur */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 0 }}>
              <motion.div style={{ x: headX }}>
                <div className="w-11 rounded-md bg-ink shadow-md" style={{ height: CARRIAGE_H }} />
                <div
                  className="mx-auto h-0 w-0"
                  style={{
                    borderLeft: "7px solid transparent",
                    borderRight: "7px solid transparent",
                    borderTop: `${NOZZLE_H}px solid var(--color-accent)`,
                  }}
                />
                {/* Filament chaud : prolonge la pointe dans la couche en cours */}
                {!reduce && (
                  <motion.div
                    className="mx-auto w-0.5 rounded-full bg-accent"
                    style={{ height: 7 }}
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
