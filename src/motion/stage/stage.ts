// Le Stage (brief « Strates », §4.4) : UN renderer WebGL persistant pour
// toutes les vues 3D des pages vitrine, derrière le contenu. Chaque vue
// (<StageView>, useStageView) est un rectangle du DOM où sa scène se dessine
// par viewport + scissor sur l'unique canvas (ancré au document, ou fixe pour
// une vue collante ou épinglée : stage-root.tsx) ; le DOM reste au-dessus, les
// titres peuvent chevaucher un objet.
//
// Rendu à la demande : une frame n'est dessinée que si une vue a bougé
// (défilement, mise en page), si ses props ou le thème ont changé, ou si sa
// scène en redemande une (animation). Le tampon de dessin n'étant pas
// conservé (preserveDrawingBuffer: false), chaque frame dessinée redessine
// toutes les vues visibles. Pause quand l'onglet est masqué (loop.ts).
//
// Paliers (§3.6) : DPR ≤ 1,5 aux deux paliers, sous un budget de pixels du
// tampon propre à chaque palier (le canvas ancré au document déborde la
// fenêtre : pixel-ratio.ts, anchor-margin.ts) ; médiane des 60 premières
// frames animées > 22 ms ⇒ déclassement (C2 → C1, C1 → C0 : la SiteShell
// démonte alors le Stage et les posters reviennent). C2 → C1 retire le champ de
// courbes et baisse le budget de pixels (le rapport est recalculé, le tampon
// réalloué : des pixels en moins à DPR > 1, aucun à DPR 1) ; l'antialiasing,
// fixé à la création du contexte, reste. En C1, une vue
// `bakeWhenIdle` au repos depuis 800 ms est figée en image dans son élément
// (le défilement natif mobile déplace alors une vraie image, sans décalage
// d'une frame) ; le moindre changement de props ou pointerdown la réveille.
// Perte de contexte : C0 pour la session, vues libérées, posters réaffichés.
import {
  Color,
  NeutralToneMapping,
  PMREMGenerator,
  SRGBColorSpace,
  WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { motionBridge } from "@/lib/motion-bridge/store";
import {
  createFrameMonitor,
  lowerDetectedCapability,
  markWebglLost,
} from "@/lib/motion-bridge/tier";
import type {
  Capability,
  SceneId,
  StageViewDescriptor,
} from "@/lib/motion-bridge/types";
import { hasCoarsePointer } from "./anchor-margin";
import { Baker } from "./bake";
import { publishController, withdrawController } from "./controllers";
import { clearGeometryCache } from "./geometry";
import { createLoop, type StageLoop } from "./loop";
import { stagePixelRatio } from "./pixel-ratio";
import { loadScene } from "./scenes";
import { getCanvasAnchor } from "./ticker";
import {
  onThemeChange,
  readStageTheme,
  readToneColor,
  sameTheme,
} from "./theme";
import type { StageContext, StageScene, ViewFrame } from "./types";
import { ViewTracker } from "./view-tracker";

const BAKE_IDLE_MS = 800;
// Au-delà, un écart entre deux frames n'est pas une frame lente mais une pause.
const MAX_SAMPLE_MS = 250;

interface ViewState {
  id: string;
  descriptor: StageViewDescriptor;
  scene: StageScene<unknown> | null;
  status: "loading" | "mounted" | "failed" | "released";
  /** data-stage-ready posé (poster effacé). */
  ready: boolean;
  wantsFrame: boolean;
  lastRenderAt: number;
  toneColor: Color;
  /** Incrémenté à chaque changement : une image figée périmée est jetée. */
  version: number;
  idleTimer: number;
  baking: boolean;
  asleep: boolean;
  baked: { img: HTMLImageElement; url: string } | null;
  /** Réveillée : retirer l'image dès que le canvas a redessiné la vue. */
  unbake: boolean;
}

function intersects(rect: DOMRectReadOnly, width: number, height: number) {
  return (
    rect.right > 0 && rect.bottom > 0 && rect.left < width && rect.top < height
  );
}

export class Stage {
  private readonly renderer: WebGLRenderer;
  private readonly envTarget: WebGLRenderTarget;
  private readonly ctx: StageContext;
  private readonly loop: StageLoop;
  private readonly tracker: ViewTracker;
  private readonly baker: Baker;
  private readonly views = new Map<string, ViewState>();
  private order: string[] = [];
  private readonly disposers: (() => void)[] = [];
  private readonly monitor = createFrameMonitor({ maxFrameMs: MAX_SAMPLE_MS });
  private readonly startedAt = performance.now();
  /** Appareil tactile (même d'un portable) : budget de pixels de C2 quel que soit le palier. */
  private readonly coarse = hasCoarsePointer();
  private width = 1;
  private height = 1;
  private dirty = true;
  private lastScrollX = Number.NaN;
  private lastScrollY = Number.NaN;
  private drewViews = false;
  private lastTickRendered = false;
  private lastRenderTime = 0;
  private bakeCount = 0;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const bridge = motionBridge.get();
    const capability = bridge.capability;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: capability === 2,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
    });
    const renderer = this.renderer;
    // this.ctx n'existe pas encore : le palier vient du pont.
    renderer.setPixelRatio(
      stagePixelRatio(
        window.devicePixelRatio,
        {
          width: Math.max(1, canvas.clientWidth),
          height: Math.max(1, canvas.clientHeight),
        },
        capability,
        this.coarse,
      ),
    );
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.outputColorSpace = SRGBColorSpace;
    // Neutral : fidélité des teintes de filament (§2.4).
    renderer.toneMapping = NeutralToneMapping;

    // Environnement procédural, rien à télécharger, partagé par les scènes.
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.envTarget = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();

    this.ctx = {
      renderer,
      envMap: this.envTarget.texture,
      capability,
      reduced: bridge.reduced,
      theme: readStageTheme(),
      invalidate: () => this.invalidate(),
    };

    this.tracker = new ViewTracker(() => {
      this.loop?.setWatching(this.tracker.anyNear());
      this.invalidate();
    });
    this.baker = new Baker(renderer);
    this.loop = createLoop((now) => this.frame(now));

    this.resizeCanvas();
    const canvasObserver = new ResizeObserver(() => this.resizeCanvas());
    canvasObserver.observe(canvas);
    const onLost = (event: Event) => this.onContextLost(event);
    canvas.addEventListener("webglcontextlost", onLost);
    const onScroll = () => this.loop.invalidate();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => this.wakeAll();
    window.addEventListener("resize", onResize, { passive: true });
    const onPointer = (event: PointerEvent) => this.onPointerDown(event);
    document.addEventListener("pointerdown", onPointer, {
      capture: true,
      passive: true,
    });
    this.disposers.push(
      () => canvasObserver.disconnect(),
      () => canvas.removeEventListener("webglcontextlost", onLost),
      () => window.removeEventListener("scroll", onScroll),
      () => window.removeEventListener("resize", onResize),
      () =>
        document.removeEventListener("pointerdown", onPointer, {
          capture: true,
        }),
      onThemeChange(() => this.onTheme()),
      motionBridge.views.subscribe(() => this.syncViews()),
      motionBridge.subscribe(() => this.onBridge()),
    );

    this.syncViews();
    motionBridge.set({
      stageReady: true,
      stage: {
        bake: (scene, props, size) => this.bake(scene, props, size),
      },
    });
  }

  // ── Vues ───────────────────────────────────────────────────────────────────

  private syncViews() {
    if (this.disposed) return;
    const list = motionBridge.views.list();
    const seen = new Set<string>();
    for (const descriptor of list) {
      seen.add(descriptor.id);
      const state = this.views.get(descriptor.id);
      if (!state) this.addView(descriptor);
      else if (state.descriptor.element !== descriptor.element) {
        this.removeView(state);
        this.addView(descriptor);
      } else if (state.descriptor !== descriptor)
        this.updateView(state, descriptor);
    }
    for (const state of Array.from(this.views.values()))
      if (!seen.has(state.id)) this.removeView(state);
    this.order = list.map((d) => d.id);
    this.invalidate();
  }

  private addView(descriptor: StageViewDescriptor) {
    const state: ViewState = {
      id: descriptor.id,
      descriptor,
      scene: null,
      status: "loading",
      ready: false,
      wantsFrame: false,
      lastRenderAt: -1,
      toneColor: new Color(readToneColor(descriptor.element, this.ctx.theme)),
      version: 0,
      idleTimer: 0,
      baking: false,
      asleep: false,
      baked: null,
      unbake: false,
    };
    this.views.set(state.id, state);
    this.tracker.add(
      state.id,
      descriptor.element,
      descriptor.liveRect ?? false,
    );
    void this.mountView(state);
  }

  private async mountView(state: ViewState) {
    let scene: StageScene<unknown> | null = null;
    try {
      const mod = await loadScene(state.descriptor.scene);
      if (state.status !== "loading" || this.disposed) return;
      scene = mod.default(this.ctx);
      const props = state.descriptor.props;
      await scene.mount(this.ctx, state.descriptor);
      if (state.status !== "loading" || this.disposed) {
        scene.dispose();
        return;
      }
      // Props changées pendant le montage asynchrone : rattraper.
      if (state.descriptor.props !== props)
        scene.update(state.descriptor.props);
      state.scene = scene;
      state.status = "mounted";
      publishController(state.id, scene.controller);
      this.scheduleIdle(state);
      this.invalidate();
    } catch (error) {
      // Scène en échec (chunk, shader) : le poster SSR reste, la page vit.
      if (scene && state.scene !== scene) scene.dispose();
      if (state.status === "loading") state.status = "failed";
      console.error(
        "[stage] scène indisponible",
        state.descriptor.scene,
        error,
      );
    }
  }

  private updateView(state: ViewState, descriptor: StageViewDescriptor) {
    const propsChanged = state.descriptor.props !== descriptor.props;
    state.descriptor = descriptor;
    this.tracker.add(
      state.id,
      descriptor.element,
      descriptor.liveRect ?? false,
    );
    state.toneColor.set(readToneColor(descriptor.element, this.ctx.theme));
    if (!propsChanged) return;
    state.version++;
    if (state.status === "mounted" && state.scene) {
      try {
        state.scene.update(descriptor.props);
      } catch (error) {
        console.error("[stage] update", error);
      }
    }
    this.wake(state);
  }

  private removeView(state: ViewState) {
    this.releaseView(state);
    this.views.delete(state.id);
    this.tracker.remove(state.id);
  }

  /** Libère la scène et rend l'élément à son état SSR (poster visible). */
  private releaseView(state: ViewState) {
    state.status = "released";
    window.clearTimeout(state.idleTimer);
    withdrawController(state.id);
    try {
      state.scene?.dispose();
    } catch {
      // Contexte perdu : les appels GL ne font plus rien, on continue.
    }
    state.scene = null;
    this.dropBaked(state);
    state.descriptor.element.removeAttribute("data-stage-ready");
    state.ready = false;
    motionBridge.views.setReady(state.id, false);
  }

  private markReady(state: ViewState) {
    if (state.ready) return;
    state.ready = true;
    state.descriptor.element.setAttribute("data-stage-ready", "true");
    motionBridge.views.setReady(state.id, true);
  }

  // ── Boucle ─────────────────────────────────────────────────────────────────

  invalidate() {
    if (this.disposed) return;
    this.dirty = true;
    this.loop.invalidate();
  }

  /**
   * Rapport de pixels du canvas : le DPR plafonné à 1,5, abaissé (jamais sous
   * 1) pour que le tampon tienne dans le budget de pixels du palier courant
   * (pixel-ratio.ts). Le budget se partage la taille CSS du canvas, qui est
   * celle de la fenêtre plus ses marges d'ancrage.
   */
  private pixelRatioFor(width: number, height: number): number {
    return stagePixelRatio(
      window.devicePixelRatio,
      { width, height },
      this.ctx.capability,
      this.coarse,
    );
  }

  private resizeCanvas() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    // Zoom du navigateur ou fenêtre passée sur un autre écran : nouveau DPR.
    const ratio = this.pixelRatioFor(width, height);
    const ratioChanged = ratio !== this.renderer.getPixelRatio();
    if (width === this.width && height === this.height && !ratioChanged) return;
    if (ratioChanged) this.renderer.setPixelRatio(ratio);
    this.width = width;
    this.height = height;
    // updateStyle false : la taille CSS reste celle de la feuille de style.
    this.renderer.setSize(width, height, false);
    this.invalidate();
  }

  private frame(now: number): boolean {
    if (this.disposed) return false;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const scrolled =
      scrollX !== this.lastScrollX || scrollY !== this.lastScrollY;

    const visible: [ViewState, DOMRectReadOnly][] = [];
    let wanted = false;
    for (const id of this.order) {
      const state = this.views.get(id);
      if (!state || state.status !== "mounted" || !state.scene) continue;
      if (state.scene.holdPoster || state.asleep) continue;
      if (!state.descriptor.liveRect && !this.tracker.isNear(id)) continue;
      const rect = this.tracker.rect(id, scrollX, scrollY);
      if (!rect || !intersects(rect, this.width, this.height)) continue;
      visible.push([state, rect]);
      wanted ||= state.wantsFrame || state.unbake || !state.ready;
      // Vue pinnée ou transformée : elle bouge sans que la page défile. Pas
      // quand elle est loin de la fenêtre (canvas ancré : elle peut se trouver
      // dans la marge, hors de vue, et ne doit pas faire redessiner au repos).
      wanted ||= state.descriptor.liveRect === true && this.tracker.isNear(id);
    }
    const needed =
      this.dirty ||
      wanted ||
      (scrolled && (visible.length > 0 || this.drewViews)) ||
      (this.drewViews && visible.length === 0);
    if (!needed) {
      this.lastTickRendered = false;
      return false;
    }

    this.dirty = false;
    this.lastScrollX = scrollX;
    this.lastScrollY = scrollY;
    const renderer = this.renderer;
    const ctx = this.ctx;
    const dpr = renderer.getPixelRatio();
    const time = (now - this.startedAt) / 1000;
    const velocity = motionBridge.get().velocity;
    // Position, dans le document, du haut du canvas : le défilement quand le
    // canvas est fixe, ce défilement moins le décalage du canvas quand il est
    // ancré. Une scène qui dessine « en coordonnées page » (le champ de
    // courbes) lit cette valeur : sans le décalage, son motif sauterait d'une
    // demi-fenêtre au passage d'un mode à l'autre (vue épinglée qui s'éloigne).
    const canvasTop = scrollY - (getCanvasAnchor()?.offsetY() ?? 0);

    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, this.width, this.height);
    renderer.setScissor(0, 0, this.width, this.height);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);

    let again = false;
    for (const [state, rect] of visible) {
      const scene = state.scene!;
      // three compte y depuis le bas du canvas, en px CSS (× pixelRatio en interne).
      const x = rect.left;
      const y = this.height - rect.bottom;
      const sx = Math.max(0, Math.floor(x));
      const sy = Math.max(0, Math.floor(y));
      const sw = Math.min(this.width, Math.ceil(x + rect.width)) - sx;
      const sh = Math.min(this.height, Math.ceil(y + rect.height)) - sy;
      if (sw <= 0 || sh <= 0) continue;
      renderer.setViewport(x, y, rect.width, rect.height);
      renderer.setScissor(sx, sy, sw, sh);
      if (state.descriptor.clear === "tone") {
        renderer.setClearColor(state.toneColor, 1);
        renderer.clear(true, true, false);
      } else renderer.clear(false, true, false);

      const frame: ViewFrame = {
        rect,
        dpr,
        time,
        dt: state.lastRenderAt < 0 ? 0 : (now - state.lastRenderAt) / 1000,
        scrollY: canvasTop,
        velocity,
      };
      let wants = false;
      try {
        wants = scene.render(ctx, frame);
      } catch (error) {
        console.error("[stage] rendu", state.descriptor.scene, error);
        this.releaseView(state);
        state.status = "failed";
        continue;
      }
      if (state.wantsFrame && !wants) this.scheduleIdle(state);
      state.wantsFrame = wants;
      state.lastRenderAt = now;
      again ||= wants;
      this.markReady(state);
      // Réveillée : le canvas porte de nouveau la vue, l'image peut partir.
      if (state.unbake) this.dropBaked(state);
    }
    renderer.setClearColor(0x000000, 0);
    this.drewViews = visible.length > 0;

    // Déclassement : seulement des frames rendues coup sur coup.
    if (
      this.lastTickRendered &&
      again &&
      this.monitor.push(now - this.lastRenderTime)
    )
      this.downgrade();
    this.lastTickRendered = true;
    this.lastRenderTime = now;
    return again;
  }

  // ── Bake au repos (C1) ─────────────────────────────────────────────────────

  private scheduleIdle(state: ViewState) {
    window.clearTimeout(state.idleTimer);
    if (!state.descriptor.bakeWhenIdle || this.ctx.capability !== 1) return;
    state.idleTimer = window.setTimeout(
      () => void this.bakeView(state),
      BAKE_IDLE_MS,
    );
  }

  private async bakeView(state: ViewState) {
    const scene = state.scene;
    if (
      this.disposed ||
      !scene ||
      scene.holdPoster ||
      state.status !== "mounted" ||
      state.asleep ||
      state.baking ||
      state.wantsFrame ||
      this.ctx.capability !== 1
    )
      return;
    const rect = this.tracker.rect(state.id, window.scrollX, window.scrollY);
    if (!rect) return;
    const version = state.version;
    const dpr = this.renderer.getPixelRatio();
    state.baking = true;
    try {
      const blob = await this.baker.capture(
        () => {
          scene.render(this.ctx, {
            rect,
            dpr,
            time: (performance.now() - this.startedAt) / 1000,
            dt: 0,
            scrollY: window.scrollY,
            velocity: 0,
          });
        },
        {
          width: rect.width * dpr,
          height: rect.height * dpr,
          background:
            state.descriptor.clear === "tone" ? state.toneColor : null,
        },
      );
      if (
        this.disposed ||
        state.version !== version ||
        state.status !== "mounted"
      )
        return;
      const url = URL.createObjectURL(blob);
      const img = document.createElement("img");
      img.className = "s3d-baked";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.draggable = false;
      img.src = url;
      await img.decode().catch(() => undefined);
      if (
        this.disposed ||
        state.version !== version ||
        state.status !== "mounted"
      ) {
        URL.revokeObjectURL(url);
        return;
      }
      // En premier enfant : les surimpressions positionnées restent au-dessus.
      const element = state.descriptor.element;
      element.insertBefore(img, element.firstChild);
      this.dropBaked(state);
      state.baked = { img, url };
      state.asleep = true;
      state.unbake = false;
      this.markReady(state);
      // La frame suivante ne dessine plus la vue : l'image la remplace.
      this.invalidate();
    } catch (error) {
      console.warn("[stage] bake au repos impossible", error);
    } finally {
      state.baking = false;
    }
  }

  private wake(state: ViewState) {
    state.version++;
    if (state.asleep) {
      state.asleep = false;
      state.unbake = true;
      // Hors de l'écran, pas de raccord à soigner : l'image part tout de suite.
      const rect = this.tracker.rect(state.id, window.scrollX, window.scrollY);
      if (!rect || !intersects(rect, this.width, this.height))
        this.dropBaked(state);
    }
    this.scheduleIdle(state);
    this.invalidate();
  }

  private wakeAll() {
    for (const state of this.views.values())
      if (state.asleep || state.baking) this.wake(state);
  }

  private dropBaked(state: ViewState) {
    state.unbake = false;
    if (!state.baked) return;
    state.baked.img.remove();
    URL.revokeObjectURL(state.baked.url);
    state.baked = null;
  }

  private onPointerDown(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    for (const state of this.views.values())
      if (state.descriptor.element.contains(target)) this.wake(state);
  }

  // ── Thème, préférence, capacité ────────────────────────────────────────────

  private onTheme() {
    const next = readStageTheme();
    if (sameTheme(next, this.ctx.theme)) return;
    this.ctx.theme = next;
    for (const state of this.views.values()) {
      state.toneColor.set(readToneColor(state.descriptor.element, next));
      // Une image figée garde les couleurs de l'ancien thème.
      if (state.asleep || state.baking) this.wake(state);
    }
    this.invalidate();
  }

  private onBridge() {
    const { capability, reduced } = motionBridge.get();
    if (reduced !== this.ctx.reduced) {
      this.ctx.reduced = reduced;
      this.invalidate();
    }
    if (capability < this.ctx.capability) this.applyCapability(capability);
  }

  private applyCapability(capability: Capability) {
    this.ctx.capability = capability;
    this.monitor.reset();
    this.lastTickRendered = false;
    if (capability === 0) {
      // La SiteShell démonte le Stage ; d'ici là, plus rien n'est dessiné.
      this.release();
      return;
    }
    // C2 → C1 : le budget de pixels du palier plus bas s'applique tout de suite
    // (setPixelRatio réalloue le tampon ; sans changement de rapport, on n'y
    // touche pas). L'antialiasing, fixé à la création du contexte, reste.
    const ratio = this.pixelRatioFor(this.width, this.height);
    if (ratio !== this.renderer.getPixelRatio())
      this.renderer.setPixelRatio(ratio);
    for (const state of this.views.values()) this.scheduleIdle(state);
    this.invalidate();
  }

  private downgrade() {
    const capability = lowerDetectedCapability();
    motionBridge.set({ capability });
    // onBridge a déjà appliqué la baisse ; au cas où le pont n'aurait pas changé :
    if (capability < this.ctx.capability) this.applyCapability(capability);
  }

  private onContextLost(event: Event) {
    event.preventDefault();
    markWebglLost();
    lowerDetectedCapability(0);
    this.release();
    motionBridge.set({
      contextLost: true,
      capability: 0,
      stageReady: false,
      stage: null,
    });
  }

  /** Libère toutes les vues (posters réaffichés) sans détruire le renderer. */
  private release() {
    for (const state of this.views.values()) this.releaseView(state);
    clearGeometryCache();
  }

  // ── Service de vignettes ───────────────────────────────────────────────────

  private async bake(
    sceneId: SceneId,
    props: unknown,
    size: { width: number; height: number },
  ): Promise<Blob> {
    if (this.disposed) throw new Error("Stage libéré");
    const mod = await loadScene(sceneId);
    // Contexte de vignette : états finaux, aucune animation, pas de boucle.
    const ctx: StageContext = {
      renderer: this.renderer,
      envMap: this.ctx.envMap,
      capability: this.ctx.capability,
      reduced: true,
      theme: this.ctx.theme,
      invalidate: () => {},
    };
    const scene = mod.default(ctx);
    const view: StageViewDescriptor = {
      id: `bake-${++this.bakeCount}`,
      scene: sceneId,
      element: document.createElement("div"),
      props,
      clear: "transparent",
    };
    try {
      await scene.mount(ctx, view);
      const rect = new DOMRectReadOnly(0, 0, size.width, size.height);
      return await this.baker.capture(
        () => {
          scene.render(ctx, {
            rect,
            dpr: 1,
            time: 0,
            dt: 0,
            scrollY: 0,
            velocity: 0,
          });
        },
        { width: size.width, height: size.height, background: null },
      );
    } finally {
      scene.dispose();
      this.invalidate();
    }
  }

  // ── Fin ────────────────────────────────────────────────────────────────────

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.disposers.splice(0)) off();
    this.loop.dispose();
    this.release();
    this.views.clear();
    this.tracker.dispose();
    this.baker.dispose();
    this.envTarget.dispose();
    this.renderer.dispose();
    // Rend le contexte au navigateur tout de suite (un seul par page, §4.11).
    // L'écouteur de perte est déjà retiré : ce n'est pas une perte subie.
    this.renderer.forceContextLoss();
    if (!motionBridge.get().contextLost)
      motionBridge.set({ stageReady: false, stage: null });
  }
}
