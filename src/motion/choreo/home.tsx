"use client";

// Chorégraphie de l'accueil (brief « Strates », §3.3, §5.5, §7.5) : l'impression
// du héros (intro, pin, bascule en plan), l'éclaté du chapitre 01 et la
// révélation des titres de chapitre. Le DOM est déjà complet et lisible : ce
// module ne fait que l'enrichir, et ne part (src/gates/home.tsx) qu'une fois le
// runtime prêt, c'est-à-dire en mouvement complet et capacité ≥ C1.
//
//  - C2 ≥ 1024 × 768 : intro 0 → 38 % en 3,2 s, puis UN SEUL pin sur tout le
//    site (180 % de la hauteur d'écran, scrub 0,6) : 0 → 110 % finit
//    l'impression, 110 → 180 % bascule la caméra en plan et ouvre le champ ;
//  - sinon (mobile, C1, fenêtre basse) : pas de pin, autoplay 0 → 100 % en
//    4,2 s quand le héros est visible à moitié, réglette Z au pouce (C1) ;
//  - titres de chapitre : SplitText par lignes, une fois, jamais sur le h1.
// Les propriétés `progress`, `tilt`, `explode` et `reveal` sont celles des
// contrôleurs des scènes (src/motion/stage/scenes) ; la scène les met en images.
// Ne parle au DOM que par les événements de contract.ts : des nombres et des
// identifiants de filament, jamais de texte saisi.
import { SplitText } from "gsap/SplitText";
import {
  HERO_EVENTS,
  HOME,
  HOME_VIEW_ATTR,
  homeSelector,
  type HeroChangeDetail,
  type HeroLayerDetail,
  type HeroScrubDetail,
  type HomeViewName,
} from "@/components/home/contract";
import type { PrintHeroProps } from "@/components/home/stage-props";
import { motionBridge } from "@/lib/motion-bridge/store";
import { gsap, ScrollTrigger, useGSAP } from "@/motion/gsap";
import { onController } from "../stage/controllers";
import type { ContourFieldController } from "../stage/scenes/contour-field";
import type { PrintHeroController } from "../stage/scenes/print-hero";

gsap.registerPlugin(SplitText);

const PIN_QUERY = "(min-width: 1024px) and (min-height: 768px)";
const INTRO_TO = 0.38;
const INTRO_S = 3.2;
const AUTOPLAY_S = 4.2;
const LAYER_MM = 0.2;

interface Controllers {
  hero?: PrintHeroController;
  heroField?: ContourFieldController;
  map?: PrintHeroController;
}

/** Retrouve une vue de l'accueil par son attribut, dès qu'elle est inscrite au pont. */
function whenView(
  name: HomeViewName,
  found: (id: string, element: HTMLElement) => void,
): () => void {
  let done = false;
  const check = () => {
    if (done) return;
    const view = motionBridge.views
      .list()
      .find((v) => v.element.getAttribute(HOME_VIEW_ATTR) === name);
    if (!view) return;
    done = true;
    stop();
    found(view.id, view.element);
  };
  const stop = motionBridge.views.subscribe(check);
  check();
  return () => {
    done = true;
    stop();
  };
}

/** Appelle `cb` une fois que la vue a rendu sa première frame (le poster s'efface). */
function whenReady(id: string, cb: () => void): () => void {
  if (motionBridge.views.isReady(id)) {
    cb();
    return () => {};
  }
  const stop = motionBridge.views.subscribeReady(() => {
    if (!motionBridge.views.isReady(id)) return;
    stop();
    cb();
  });
  return stop;
}

function emit<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

export function HomeChoreo() {
  useGSAP(() => {
    const disposers: (() => void)[] = [];
    const ctrl: Controllers = {};
    const capability = motionBridge.get().capability;
    const heroEl = document.querySelector<HTMLElement>(homeSelector(HOME.hero));
    if (!heroEl) return;

    // ── Contrôleurs ──────────────────────────────────────────────────────
    const state = { intro: 0, scrub: 0, tilt: 0, reveal: 0, auto: 0 };
    let manual = false;
    const progressOf = () =>
      manual
        ? (ctrl.hero?.progress ?? 0)
        : state.auto > 0
          ? state.auto
          : state.intro + (1 - state.intro) * state.scrub;
    const apply = () => {
      if (ctrl.hero) {
        if (!manual) ctrl.hero.progress = progressOf();
        ctrl.hero.tilt = state.tilt;
      }
      if (ctrl.heroField) ctrl.heroField.reveal = state.reveal;
    };

    let total = 750;
    disposers.push(
      whenView("hero", (id) => {
        const props = motionBridge.views.get(id)?.props as
          | PrintHeroProps
          | undefined;
        if (props) total = Math.round(props.config.h / LAYER_MM);
        disposers.push(
          onController<PrintHeroController>(id, (c) => {
            ctrl.hero = c;
            c.onLayer = (layer, z, band) =>
              emit<HeroLayerDetail>(HERO_EVENTS.layer, {
                layer,
                total,
                z,
                band,
              });
            c.onBandCross = (band, layer, filament) =>
              emit<HeroChangeDetail>(HERO_EVENTS.change, {
                band,
                layer,
                filament,
              });
            apply();
          }),
        );
      }),
      whenView("heroField", (id) =>
        disposers.push(
          onController<ContourFieldController>(id, (c) => {
            ctrl.heroField = c;
            apply();
          }),
        ),
      ),
    );

    // ── Héros : pin (C2, grand écran) ou autoplay ────────────────────────
    let intro: gsap.core.Tween | null = null;
    let autoplay: gsap.core.Tween | null = null;
    const mm = gsap.matchMedia();
    mm.add({ wide: PIN_QUERY }, (context) => {
      const pinned = context.conditions?.wide === true && capability === 2;
      return pinned ? pinHero() : autoplayHero();
    });
    disposers.push(() => mm.revert());

    function pinHero() {
      intro = gsap.to(state, {
        intro: INTRO_TO,
        duration: INTRO_S,
        ease: "none",
        paused: true,
        onUpdate: apply,
      });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: heroEl,
          // Sous l'en-tête collant de 64 px.
          start: "top 64px",
          end: () => `+=${Math.round(window.innerHeight * 1.8)}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            // Page retrouvée plus bas (rechargement, ancre) : pas d'intro à jouer.
            if (self.progress > 0.02) intro?.progress(1);
          },
        },
      });
      tl.to(state, { scrub: 1, duration: 1.1, onUpdate: apply }, 0).to(
        state,
        { tilt: 1, reveal: 1, duration: 0.7, ease: "s3d.carte", onUpdate: apply },
        1.1,
      );
      disposers.push(
        whenView("hero", (id) =>
          disposers.push(whenReady(id, () => intro?.play())),
        ),
      );
      return () => {
        intro = null;
      };
    }

    function autoplayHero() {
      autoplay = gsap.to(state, {
        auto: 1,
        duration: AUTOPLAY_S,
        ease: "none",
        paused: true,
        onUpdate: apply,
      });
      // « Quand le héros est visible à 50 % » : après sa première frame.
      let ready = false;
      let visible = false;
      const start = () => {
        if (ready && visible) autoplay?.play();
      };
      const stopView = whenView("hero", (id, element) => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            start();
          },
          { threshold: 0.5 },
        );
        observer.observe(element);
        disposers.push(
          () => observer.disconnect(),
          whenReady(id, () => {
            ready = true;
            start();
          }),
        );
      });
      return () => {
        stopView();
        autoplay = null;
      };
    }

    // Réglette Z (mobile) : le geste du visiteur remplace l'autoplay.
    const onScrub = (event: Event) => {
      const { progress } = (event as CustomEvent<HeroScrubDetail>).detail;
      autoplay?.kill();
      manual = true;
      if (ctrl.hero) ctrl.hero.progress = progress;
    };
    window.addEventListener(HERO_EVENTS.scrub, onScrub);
    disposers.push(() => window.removeEventListener(HERO_EVENTS.scrub, onScrub));

    // « Passer l'animation » : l'intro et l'autoplay se terminent tout de suite ;
    // le défilement vers le chapitre 01 est fait par l'ancre (Lenis ou natif).
    const onSkip = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(homeSelector(HOME.skip))
      ) {
        intro?.progress(1);
        autoplay?.progress(1);
      }
    };
    document.addEventListener("click", onSkip);
    disposers.push(() => document.removeEventListener("click", onSkip));

    // Perte du contexte WebGL : plus de canvas, plus de pin qui retiendrait la
    // page sur un poster.
    disposers.push(
      motionBridge.subscribe(() => {
        if (!motionBridge.get().contextLost) return;
        mm.revert();
        ScrollTrigger.refresh();
      }),
    );

    // ── Chapitre 01 : l'éclaté à l'entrée ────────────────────────────────
    disposers.push(
      whenView("map", (id, element) => {
        disposers.push(
          onController<PrintHeroController>(id, (c) => {
            ctrl.map = c;
            // Les coques s'empilent avant l'entrée, puis s'écartent (1,2 s).
            c.explode = 0;
            ScrollTrigger.create({
              trigger: element,
              start: "top 70%",
              once: true,
              onEnter: () =>
                void gsap.to(c, {
                  explode: 1,
                  duration: 1.2,
                  ease: "s3d.buse",
                }),
            });
          }),
        );
      }),
    );

    // ── Titres de chapitre : SplitText par lignes, une fois ──────────────
    const titles = gsap.utils.toArray<HTMLElement>(
      `[data-chapter]:not([data-chapter="00"]) h2`,
    );
    for (const title of titles)
      SplitText.create(title, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 0.8,
            ease: "s3d.strate",
            stagger: 0.04,
            scrollTrigger: { trigger: title, start: "top 85%", once: true },
          }),
      });

    return () => {
      for (const dispose of disposers.splice(0).reverse()) dispose();
    };
  }, []);

  return null;
}
