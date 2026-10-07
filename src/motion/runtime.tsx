"use client";

// MotionRuntime (brief « Strates », §4.3) : Lenis + GSAP pour les pages
// vitrine. Chargé par la SiteShell via src/gates/runtime.tsx après
// l'hydratation, seulement en mouvement complet et en capacité ≥ C1
// (useMotionShell) ; quitter (site) le démonte, si bien que panier, checkout,
// compte, admin, OAuth, suivi et légal ne voient jamais Lenis.
//
// Une seule boucle : gsap.ticker fait avancer Lenis, qui pousse chaque
// défilement à ScrollTrigger ; le Stage se branche sur la même horloge
// (stage/ticker.ts), donc DOM, scrubs et canvas bougent dans la même frame.
// Le composant ne rend rien.
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  readReducedMotion,
  subscribeMotionPreference,
} from "@/lib/motion-bridge/motion-pref";
import { motionBridge } from "@/lib/motion-bridge/store";
import type { BridgeScroll } from "@/lib/motion-bridge/types";
import { ScrollTrigger, gsap } from "./gsap";
import {
  notifyLayout,
  setFrameDriver,
  type FrameCallback,
} from "./stage/ticker";

// Header de 64 px + 16 px d'air : ancres et défilements vers un élément.
const HEADER_OFFSET = -80;
const PROGRESS_VAR = "--s3d-progress";

class Runtime {
  private lenis: Lenis | null = null;
  private locked = false;
  private velocity = 0;
  private writtenVelocity = 0;
  private writtenProgress = -1;
  private readonly disposers: (() => void)[] = [];
  private readonly wrapped = new Map<FrameCallback, () => void>();
  private route: AbortController | null = null;
  private destroyed = false;

  private readonly scroll: BridgeScroll = {
    to: (target, o) => {
      const offset =
        o?.offset ?? (typeof target === "number" ? 0 : HEADER_OFFSET);
      if (this.lenis) {
        this.lenis.scrollTo(target, { offset, immediate: o?.immediate });
        return;
      }
      // Sans Lenis (le pont passe alors scroll à null), repli natif et
      // instantané, comme en mouvement réduit.
      const el =
        typeof target === "string"
          ? document.querySelector<HTMLElement>(target)
          : typeof target === "number"
            ? null
            : target;
      const top =
        typeof target === "number"
          ? target
          : el
            ? el.getBoundingClientRect().top + window.scrollY
            : null;
      if (top !== null)
        window.scrollTo({ top: top + offset, behavior: "auto" });
    },
    lock: (on) => {
      // Mémorisé : un Lenis recréé pendant qu'un tiroir est ouvert reste arrêté.
      this.locked = on;
      if (on) this.lenis?.stop();
      else this.lenis?.start();
    },
  };

  private readonly tick = (time: number) => {
    const lenis = this.lenis;
    // gsap.ticker donne des secondes ; Lenis attend des millisecondes.
    lenis?.raf(time * 1000);
    // Vitesse lissée (px/frame) pour les scènes (resserrement des courbes du
    // champ, §13 annexe A) : écrite dans le pont seulement si elle bouge.
    const target = lenis?.isScrolling ? lenis.velocity : 0;
    this.velocity += (target - this.velocity) * 0.2;
    if (Math.abs(this.velocity) < 0.01) this.velocity = 0;
    if (
      this.velocity !== this.writtenVelocity &&
      (this.velocity === 0 ||
        Math.abs(this.velocity - this.writtenVelocity) > 0.05)
    ) {
      this.writtenVelocity = this.velocity;
      motionBridge.set({ velocity: this.velocity });
    }
  };

  private readonly onScroll = (lenis: Lenis) => {
    ScrollTrigger.update();
    this.writeProgress(lenis.progress);
  };

  start() {
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(this.tick);
    // Horloge du Stage : ajoutée après le tick de Lenis, elle rend chaque
    // frame une fois le défilement et les tweens à jour.
    setFrameDriver({
      add: (cb) => {
        if (this.wrapped.has(cb)) return;
        const run = () => cb(performance.now());
        this.wrapped.set(cb, run);
        gsap.ticker.add(run);
      },
      remove: (cb) => {
        const run = this.wrapped.get(cb);
        if (!run) return;
        gsap.ticker.remove(run);
        this.wrapped.delete(cb);
      },
    });
    ScrollTrigger.addEventListener("refresh", notifyLayout);
    this.disposers.push(
      () => ScrollTrigger.removeEventListener("refresh", notifyLayout),
      subscribeMotionPreference(() => this.sync()),
    );
    this.sync();
    motionBridge.set({ runtimeReady: true });
  }

  /** Crée ou détruit Lenis selon la préférence de mouvement du moment. */
  private sync() {
    if (this.destroyed) return;
    const wanted = !readReducedMotion();
    if (wanted && !this.lenis) {
      const lenis = new Lenis({
        autoRaf: false,
        lerp: 0.1,
        smoothWheel: true,
        // Le tactile reste natif (défilement composité, inertie du système).
        syncTouch: false,
        anchors: { offset: HEADER_OFFSET },
        stopInertiaOnNavigate: true,
        allowNestedScroll: true,
        // La préférence est tranchée ici (data-motion : un choix explicite
        // « full » l'emporte sur le réglage du système), pas par Lenis.
        respectReducedMotion: false,
        prevent: (node) =>
          Boolean(node.closest?.("[data-lenis-prevent], dialog[open]")),
      });
      lenis.on("scroll", this.onScroll);
      if (this.locked) lenis.stop();
      this.lenis = lenis;
      this.writeProgress(lenis.progress);
      motionBridge.set({ scroll: this.scroll });
      this.refresh();
    } else if (!wanted && this.lenis) {
      this.dropLenis();
      this.refresh();
    }
  }

  private dropLenis() {
    // Lenis 1.3.26 : destroy() ne coupe pas le minuteur de 400 ms armé par un
    // défilement natif (_resetVelocityTimeout). À son expiration, le setter
    // isScrolling remettait la classe « lenis » sur <html> alors que Lenis
    // n'existait plus (interrupteur actionné ou tap sur « Panier » juste après
    // un défilement). stop(), API publique, appelle reset() en interne (sans
    // autoToggle, notre cas) et passe isScrolling à false d'abord : le
    // minuteur ne change alors plus rien, et destroy() nettoie les classes
    // pour de bon.
    this.lenis?.stop();
    this.lenis?.destroy();
    this.lenis = null;
    this.writtenProgress = -1;
    document.documentElement.style.removeProperty(PROGRESS_VAR);
    motionBridge.set({ scroll: null });
  }

  private writeProgress(progress: number) {
    const value = Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : 0;
    if (Math.abs(value - this.writtenProgress) < 0.001) return;
    this.writtenProgress = value;
    document.documentElement.style.setProperty(PROGRESS_VAR, value.toFixed(4));
  }

  private refresh() {
    ScrollTrigger.refresh();
  }

  /**
   * Retour du propriétaire R15 (07.10.2026) : une navigation ne remettait pas
   * la page en haut. Next remonte bien à 0 (`scrollTop = 0` dans son effet de
   * mise en page), mais ScrollTrigger ne le sait pas : il garde en cache la
   * position lue au dernier défilement (Lenis, 4 769 px par exemple) tant que
   * l'événement « scroll » n'est pas arrivé, et enregistre ce chiffre périmé
   * (`rec`) quand la chorégraphie de la nouvelle page se monte ; chaque
   * refresh() la RESTAURE alors en fin de course (mesuré : scrollTo(0, 4769) à
   * chaque refresh, la page d'arrivée s'ouvrait en bas, bornée à sa hauteur).
   * Ici : cache invalidé, relecture réelle de window.scrollY, puis mémoire
   * oubliée. La restauration native du retour arrière reste intacte (le
   * navigateur positionne la page, ScrollTrigger relit cette position).
   */
  private resyncScroll() {
    ScrollTrigger.update();
    // Sans argument, la fonction de défilement LIT la position (les types de
    // GSAP ne décrivent que l'écriture).
    (ScrollTrigger.getScrollFunc(window) as unknown as () => number)();
    ScrollTrigger.clearScrollMemory();
  }

  /**
   * Nouvelle page (ou premier montage) : dimensions de Lenis, puis
   * ScrollTrigger.refresh() à la frame suivante, après les polices, et après
   * le chargement des images au-dessus de la ligne de flottaison (§3.3).
   */
  onRoute() {
    if (this.destroyed) return;
    this.route?.abort();
    const route = new AbortController();
    this.route = route;
    // Lenis arrête son interpolation en cours (sinon il continuerait vers
    // l'ancienne cible, après un router.push() par exemple) et se recale sur la
    // position réelle ; ScrollTrigger en fait autant (resyncScroll).
    // stop() puis start() : reset() est privé dans les types de Lenis, mais
    // ces deux appels publics y passent (interpolation coupée, cible =
    // position réelle). Pas pendant un tiroir ouvert : Lenis est déjà arrêté,
    // et start() le rendrait au défilement.
    if (this.lenis && !this.locked) {
      this.lenis.stop();
      this.lenis.start();
    }
    this.lenis?.resize();
    this.resyncScroll();
    requestAnimationFrame(() => {
      if (route.signal.aborted) return;
      this.refresh();
      let timer = 0;
      const soon = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (!route.signal.aborted) this.refresh();
        }, 100);
      };
      for (const img of Array.from(document.images))
        if (
          !img.complete &&
          img.getBoundingClientRect().top < window.innerHeight
        )
          img.addEventListener("load", soon, {
            once: true,
            signal: route.signal,
          });
    });
    void document.fonts?.ready.then(() => {
      if (!route.signal.aborted) this.refresh();
    });
  }

  destroy() {
    this.destroyed = true;
    this.route?.abort();
    for (const dispose of this.disposers.splice(0)) dispose();
    gsap.ticker.remove(this.tick);
    for (const run of this.wrapped.values()) gsap.ticker.remove(run);
    this.wrapped.clear();
    setFrameDriver(null);
    gsap.ticker.lagSmoothing(500, 33);
    this.dropLenis();
    motionBridge.set({ runtimeReady: false, velocity: 0 });
  }
}

export function MotionRuntime() {
  const pathname = usePathname();
  const runtime = useRef<Runtime | null>(null);

  useEffect(() => {
    const instance = new Runtime();
    instance.start();
    runtime.current = instance;
    return () => {
      instance.destroy();
      runtime.current = null;
    };
  }, []);

  // Déclaré après l'effet de création : au montage, il part juste après lui.
  useEffect(() => {
    runtime.current?.onRoute();
  }, [pathname]);

  return null;
}
