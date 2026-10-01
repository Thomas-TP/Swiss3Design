// Scène « studio-object » (brief « Strates », §4.4, §6.7, §9.2) : l'objet du
// Studio (et du chapitre 02 de l'accueil) sur le plateau de 256 × 256 mm. Elle
// ne calcule aucune forme : elle demande ses maillages au Worker de géométrie
// partagé (src/motion/studio/worker-client.ts), les enveloppe dans des
// BufferGeometry et les peint avec le matériau d'impression (coupe, bandes,
// lignes fantômes, vague de couleur, réimpression).
//
// Contrat de vue : `StudioObjectViewProps` (config, textes, vue orbite ou plan,
// coupe, éclaté, simulation, autorotation) plus les ajouts facultatifs de
// scene-props.ts (langue, « réimpression », durée réelle, rappels d'état à
// 10 Hz au plus). Sans eux la scène fonctionne : l'accueil n'en passe aucun.
//
// Calcul : un seul maillage en vol, le plus récent après lui (les réponses
// périmées ne sont jamais empilées). Un glissé construit en basse définition
// (`drag`), 150 ms de repos plus tard en `display` (C2 ≈ 115 k triangles, C1 ≈
// 38 k). Les tampons GPU sont mis à jour en place quand la taille ne change pas
// (aucune réallocation pendant un glissé). Tant qu'aucun maillage n'est arrivé,
// `holdPoster` garde le poster SSR (le dessin 2D exact) à l'écran.
//
// Mouvement réduit : états finaux, aucune vague, aucune réimpression, aucune
// inertie, aucune autorotation, aucune simulation animée ; le rendu se fait
// seulement à la demande (le Stage ne redessine que sur invalidate()).
import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import {
  EXPLODE_GAP,
  STUDIO_VIEW_EVENT,
  type StudioBandAnchor,
  type StudioSceneProps,
  type StudioSceneStatus,
  type StudioViewCommand,
} from "@/components/studio/scene-props";
import { filamentHex } from "@/lib/studio/filaments";
import type { MeshData } from "@/lib/studio/types";
import { getStudioWorker } from "@/motion/studio/worker-client";
import type { BuildJob, BuiltMesh } from "@/motion/studio/protocol";
import {
  AZIMUTH_START,
  FOV_DEG,
  POLAR_FRONT,
  POLAR_START,
  SETTLE_MS,
  TILT_STEP,
  TURN_STEP,
  angleGap,
  clamp,
  clampPolar,
  clampZoom,
  explodeOffset,
  explodedHeight,
  fitDistance,
  fitDistancePlan,
  isRapidChange,
  layerAt,
  onlyColorsChanged,
  orbitPosition,
  rad,
  reprintFront,
  rippleFront,
  simulationState,
} from "@/motion/studio/scene-math";
import { meshToGeometry, updateGeometry } from "../geometry";
import {
  createPrintMaterial,
  type PrintBand,
  type PrintMaterial,
} from "../materials/print-material";
import type { StageContext, StageScene, StageTheme, ViewFrame } from "../types";

/** Plateau des machines de l'atelier : 256 mm (P1S), maille de 16 mm. */
const PLATE_HALF = 128;
const GRID_STEP = 16;
const GRID_MAJOR_EVERY = 4;
const PLAN_POLAR = 0.001;
const RAD_PER_PX = rad(0.5);
const POLAR_PER_PX = rad(0.3);
const AUTO_ROTATE = rad(6); // rad/s, soit un tour en 60 s
const AUTO_RESUME_S = 2.5;
const REPRINT_S = 0.8;
const RIPPLE_S = 0.7;
const STATUS_INTERVAL_MS = 100;
const SIM_INTERVAL_MS = 100;
const ANCHOR_INTERVAL_MS = 100;
const SLOW_BUILD_MS = 300;
/** Pas d'effet en cours / effet à démarrer à la prochaine frame (son horloge). */
const NONE = -1;
const PENDING = -2;
/** Front de vague « au-dessus de tout » : les teintes actuelles partout. */
const RIPPLE_OFF = 1e6;

type StudioSceneState = StudioSceneStatus["state"];

interface Display {
  group: Group;
  meshes: Mesh[];
  /** Géométrie unique (entier) ; null en éclaté. */
  whole: BufferGeometry | null;
  /** Une géométrie par bande (éclaté) ; vide sinon. */
  parts: BufferGeometry[];
  /** Porteuse des tampons partagés des parts (éclaté). */
  carrier: BufferGeometry | null;
  material: PrintMaterial;
  built: BuiltMesh;
  separate: boolean;
  bands: PrintBand[];
}

function plateGrid() {
  const minor: number[] = [];
  const major: number[] = [];
  const border: number[] = [];
  const steps = (PLATE_HALF * 2) / GRID_STEP;
  for (let i = 0; i <= steps; i++) {
    const v = -PLATE_HALF + i * GRID_STEP;
    const edge = i === 0 || i === steps;
    const target = edge ? border : i % GRID_MAJOR_EVERY === 0 ? major : minor;
    target.push(v, -PLATE_HALF, 0, v, PLATE_HALF, 0);
    target.push(-PLATE_HALF, v, 0, PLATE_HALF, v, 0);
  }
  const make = (positions: number[], opacity: number) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({
      transparent: true,
      opacity,
      toneMapped: false,
      depthWrite: false,
    });
    const lines = new LineSegments(geometry, material);
    lines.renderOrder = -1;
    return lines;
  };
  const group = new Group();
  const minorLines = make(minor, 0.85);
  const majorLines = make(major, 1);
  const borderLines = make(border, 1);
  group.add(minorLines, majorLines, borderLines);
  // Sous le plateau d'un cheveu : les parois de l'objet restent devant.
  group.position.z = -0.05;
  return {
    group,
    setTheme(theme: StageTheme) {
      minorLines.material.color.set(theme.iso);
      majorLines.material.color.set(theme.isoIndex);
      borderLines.material.color.set(theme.isoIndex);
    },
    dispose() {
      for (const lines of [minorLines, majorLines, borderLines]) {
        lines.geometry.dispose();
        lines.material.dispose();
      }
    },
  };
}

/** Une géométrie par bande, avec les tampons de `carrier` (l'éclaté ne copie que les index). */
function splitByBand(
  mesh: MeshData,
  carrier: BufferGeometry,
  bandCount: number,
): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let band = 0; band < bandCount; band++) {
    const ranges = mesh.groups.filter((g) => g.band === band);
    const total = ranges.reduce((n, g) => n + g.count, 0);
    if (total === 0) continue;
    const index = new Uint32Array(total);
    let offset = 0;
    for (const g of ranges) {
      index.set(mesh.indices.subarray(g.start, g.start + g.count), offset);
      offset += g.count;
    }
    const part = new BufferGeometry();
    part.setAttribute("position", carrier.getAttribute("position"));
    part.setAttribute("normal", carrier.getAttribute("normal"));
    const side = carrier.getAttribute("side");
    if (side) part.setAttribute("side", side);
    part.setIndex(new BufferAttribute(index, 1));
    part.boundingBox = carrier.boundingBox;
    part.boundingSphere = carrier.boundingSphere;
    part.userData.band = band;
    parts.push(part);
  }
  return parts;
}

/**
 * Un cheveu au-dessus de chaque frontière de bande : une face horizontale posée
 * EXACTEMENT sur une frontière (le dessus de la plaque d'une carte, le socle d'un
 * sous-verre, un sommet de strate) a une hauteur interpolée qui flotte de
 * 1e-7 mm autour d'elle ; le shader, qui compare `vZ > frontière`, y mélangerait
 * pixel par pixel les deux teintes (un grain de poivre sur toute la face). Avec
 * 0,02 mm de marge, la face appartient franchement à la bande du dessous ; sur
 * une paroi, 0,02 mm est dix fois moins qu'une couche : invisible.
 */
const BAND_EPSILON_MM = 0.02;

const toPrintBands = (built: BuiltMesh): PrintBand[] =>
  built.bands.map((b) => ({
    topMm: b.toMm + BAND_EPSILON_MM,
    color: filamentHex(b.filament),
  }));

const create = (ctx: StageContext): StageScene<StudioSceneProps> => {
  const scene = new Scene();
  scene.environment = ctx.envMap;
  scene.environmentIntensity = 0.6;
  // Lumière du nord-ouest (convention d'estompage suisse : en haut à gauche).
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 1.4, 0.8).normalize().multiplyScalar(400);
  scene.add(sun);

  // Z vers le haut du générateur → Y vers le haut de three : −90° autour de X.
  const root = new Group();
  root.rotation.x = -Math.PI / 2;
  scene.add(root);
  const grid = plateGrid();
  root.add(grid.group);
  const camera = new PerspectiveCamera(FOV_DEG, 1, 10, 6000);

  let view: { element: HTMLElement } | null = null;
  let props: StudioSceneProps | null = null;
  let theme: StageTheme | null = null;
  let disposed = false;
  let display: Display | null = null;
  let outgoing: Display | null = null;

  // ── Caméra ──
  let azimuth = AZIMUTH_START;
  let polar = POLAR_START;
  let azimuthTarget = azimuth;
  let polarTarget = polar;
  let userAzimuth = AZIMUTH_START;
  let userPolar = POLAR_START;
  let zoom = 1;
  let zoomTarget = 1;
  let planMode = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastInteractionAt = Number.NEGATIVE_INFINITY;
  const target = new Vector3();
  const projector = new Vector3();
  const disposers: (() => void)[] = [];

  // ── Calcul ──
  let busy = false;
  let wanted: BuildJob | null = null;
  let seq = 0;
  let appliedSeq = 0;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let settleTimer = 0;
  let slowTimer = 0;
  let resolveFirst: (() => void) | null = null;
  const firstMesh = new Promise<void>((resolve) => {
    resolveFirst = resolve;
  });
  let lastStatusAt = 0;
  let lastReported: StudioSceneStatus["state"] | null = null;

  // ── Effets (temps de la frame : `frame.time`, secondes depuis le Stage) ──
  let pendingReprint = false;
  let lastReprint = 0;
  let reprintStart = NONE;
  let rippleStart = NONE;
  let lastSimAt = 0;
  let lastAnchorAt = 0;
  let anchorsCleared = true;
  let lastAnchors = "";
  let simulating = false;

  // ── Rapports vers le DOM ──

  function report(
    state: StudioSceneState,
    extra: Partial<StudioSceneStatus> = {},
    force = false,
  ) {
    const now = performance.now();
    if (
      !force &&
      state === lastReported &&
      now - lastStatusAt < STATUS_INTERVAL_MS
    )
      return;
    lastReported = state;
    lastStatusAt = now;
    props?.onStatus?.({
      state,
      triangles: display?.built.mesh.triangles ?? 0,
      ms: display?.built.ms ?? 0,
      ...extra,
    });
  }

  function applyTheme(next: StageTheme) {
    theme = next;
    grid.setTheme(next);
    display?.material.setTheme(next);
    outgoing?.material.setTheme(next);
  }

  // ── Affichage d'un maillage ──

  function disposeDisplay(d: Display) {
    root.remove(d.group);
    for (const part of d.parts) part.dispose();
    d.carrier?.dispose();
    d.whole?.dispose();
    d.material.dispose();
  }

  function buildDisplay(
    built: BuiltMesh,
    separate: boolean,
    material: PrintMaterial | null,
  ): Display {
    const mat =
      material ??
      createPrintMaterial({
        heightMm: built.heightMm,
        bands: toPrintBands(built),
      });
    if (!material && theme) mat.setTheme(theme);
    mat.uniforms.uHeight.value = built.heightMm;
    const group = new Group();
    const meshes: Mesh[] = [];
    let whole: BufferGeometry | null = null;
    let parts: BufferGeometry[] = [];
    let carrier: BufferGeometry | null = null;
    if (separate) {
      carrier = meshToGeometry(built.mesh);
      parts = splitByBand(built.mesh, carrier, built.bands.length);
      for (const part of parts) {
        const mesh = new Mesh(part, mat.material);
        mesh.position.z = explodeOffset(
          part.userData.band as number,
          EXPLODE_GAP,
        );
        mesh.frustumCulled = false;
        group.add(mesh);
        meshes.push(mesh);
      }
    } else {
      whole = meshToGeometry(built.mesh);
      const mesh = new Mesh(whole, mat.material);
      mesh.frustumCulled = false;
      group.add(mesh);
      meshes.push(mesh);
    }
    root.add(group);
    return {
      group,
      meshes,
      whole,
      parts,
      carrier,
      material: mat,
      built,
      separate,
      bands: toPrintBands(built),
    };
  }

  /** Remplace le maillage affiché : en place si possible, sinon une géométrie neuve. */
  function setBuilt(built: BuiltMesh, separate: boolean) {
    const previous = display;
    // Pas de réimpression en vue, même découpage en bandes, même nombre de
    // coques : on remplace les données sur place.
    if (
      previous &&
      !separate &&
      !previous.separate &&
      previous.whole &&
      !pendingReprint &&
      reprintStart === NONE
    ) {
      const next = updateGeometry(previous.whole, built.mesh);
      if (next !== previous.whole) {
        previous.whole = next;
        for (const mesh of previous.meshes) mesh.geometry = next;
      }
      const wasBands = previous.built.bands;
      previous.built = built;
      previous.material.uniforms.uHeight.value = built.heightMm;
      const bands = toPrintBands(built);
      if (onlyColorsChanged(wasBands, built.bands) && !ctx.reduced) {
        previous.material.setBands(bands, previous.bands);
        rippleStart = PENDING;
      } else {
        previous.material.setBands(bands);
        rippleStart = NONE;
        previous.material.uniforms.uRippleActive.value = 0;
        previous.material.uniforms.uRippleZ.value = RIPPLE_OFF;
      }
      previous.bands = bands;
      applyCut();
      return;
    }
    const startReprint =
      pendingReprint &&
      previous !== null &&
      !ctx.reduced &&
      reprintStart === NONE;
    pendingReprint = false;
    const next = buildDisplay(built, separate, null);
    if (previous) {
      if (startReprint) {
        // Ancien objet : garde le dessus, nouveau : garde le dessous, un front
        // lumineux monte de l'un à l'autre (« réimpression », §6.7).
        if (outgoing) disposeDisplay(outgoing);
        outgoing = previous;
        reprintStart = PENDING;
        previous.material.uniforms.uReprintSide.value = 1;
        next.material.uniforms.uReprintSide.value = -1;
      } else if (reprintStart !== NONE && outgoing) {
        // Un maillage plus fin arrive en pleine réimpression : le nouvel objet
        // reprend la place du précédent dans le même front.
        const u = next.material.uniforms;
        const was = previous.material.uniforms;
        u.uReprintSide.value = was.uReprintSide.value;
        u.uReprintZ.value = was.uReprintZ.value;
        u.uReprintActive.value = was.uReprintActive.value;
        disposeDisplay(previous);
      } else {
        disposeDisplay(previous);
      }
      if (startReprint) {
        for (const d of [previous, next]) {
          d.material.uniforms.uReprintActive.value = 1;
          d.material.uniforms.uReprintZ.value = 0;
        }
      }
    }
    display = next;
    applyCut();
  }

  // ── Coupe, simulation ──

  function applyCut(cut: number | null = props?.cutZ ?? null) {
    if (!display) return;
    const u = display.material.uniforms;
    const height = display.built.heightMm;
    if (cut === null) {
      display.material.setCut(height);
      u.uGhost.value = 0;
      u.uHot.value = 0;
      return;
    }
    const z = clamp(cut, 0, height);
    display.material.setCut(z);
    u.uGhost.value = 1;
    u.uHot.value = z < height - 1e-3 ? 1 : 0;
  }

  // ── Construction demandée au Worker ──

  function jobFor(lod: BuildJob["lod"]): BuildJob | null {
    if (!props) return null;
    return {
      config: props.config,
      texts: props.texts,
      lod,
      tier: ctx.capability === 1 ? 1 : 2,
      separate: props.exploded,
      locale: props.locale ?? "fr",
    };
  }

  function request(lod: BuildJob["lod"]) {
    const job = jobFor(lod);
    if (!job) return;
    wanted = job;
    void pump();
  }

  async function pump() {
    if (busy) return;
    busy = true;
    try {
      while (wanted && !disposed) {
        const job = wanted;
        wanted = null;
        const mine = ++seq;
        window.clearTimeout(slowTimer);
        slowTimer = window.setTimeout(
          () => report("building", {}, true),
          SLOW_BUILD_MS,
        );
        try {
          const built = await getStudioWorker().build(job);
          window.clearTimeout(slowTimer);
          if (disposed) return;
          // Une réponse plus ancienne que celle déjà affichée n'est jamais peinte.
          if (mine > appliedSeq) {
            appliedSeq = mine;
            setBuilt(built, job.separate);
            ctx.invalidate();
            report("ready", { lod: job.lod }, job.lod === "display");
          }
          resolveFirst?.();
        } catch (error) {
          window.clearTimeout(slowTimer);
          if (disposed) return;
          const message =
            error instanceof Error ? error.message : String(error);
          console.error("[studio-object] maillage indisponible", error);
          report("error", { message }, true);
          resolveFirst?.();
        }
      }
    } finally {
      busy = false;
    }
  }

  /** Un changement de configuration : basse définition au fil du geste, définition d'affichage au repos. */
  function onConfigChanged() {
    const now = performance.now();
    const rapid = isRapidChange({
      sinceLastChangeMs: now - lastChangeAt,
      busy,
    });
    lastChangeAt = now;
    window.clearTimeout(settleTimer);
    if (!display || !rapid) {
      request("display");
      return;
    }
    request("drag");
    settleTimer = window.setTimeout(() => request("display"), SETTLE_MS);
  }

  // ── Interaction : orbite, zoom, commandes ──

  const markInteraction = () => {
    lastInteractionAt = performance.now() / 1000;
  };

  function setOrbit(nextAzimuth: number, nextPolar: number) {
    userAzimuth = nextAzimuth;
    userPolar = clampPolar(nextPolar);
    if (!planMode) {
      azimuthTarget = userAzimuth;
      polarTarget = userPolar;
    }
  }

  function turn(step: number) {
    if (planMode) return;
    markInteraction();
    setOrbit(userAzimuth + step, userPolar);
    if (ctx.reduced) azimuth = azimuthTarget;
    ctx.invalidate();
  }

  function command(cmd: StudioViewCommand) {
    switch (cmd.type) {
      case "turn":
        turn(cmd.step * TURN_STEP);
        return;
      case "zoom":
        markInteraction();
        zoomTarget = clampZoom(zoomTarget * (cmd.step > 0 ? 1.2 : 1 / 1.2));
        if (ctx.reduced) zoom = zoomTarget;
        ctx.invalidate();
        return;
      case "front":
        markInteraction();
        setOrbit(0, POLAR_FRONT);
        if (ctx.reduced) {
          azimuth = azimuthTarget;
          polar = polarTarget;
        }
        ctx.invalidate();
        return;
      case "reset":
        markInteraction();
        setOrbit(AZIMUTH_START, POLAR_START);
        zoomTarget = 1;
        if (ctx.reduced) {
          azimuth = azimuthTarget;
          polar = polarTarget;
          zoom = 1;
        }
        ctx.invalidate();
        return;
      case "retry":
        report("building", {}, true);
        request("display");
        return;
    }
  }

  // Pincer à deux doigts : zoom (§3.5, tactile) ; un doigt : orbite.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStart = 0;
  let pinchZoom = 1;
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onPointerDown(event: PointerEvent) {
    if (!display) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const hit = event.target;
    if (
      hit instanceof Element &&
      hit.closest("[data-no-orbit], button, a, input, select, textarea, label")
    )
      return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      view?.element.setPointerCapture(event.pointerId);
    } catch {
      // Pointeur déjà libéré : le geste se terminera à pointerup.
    }
    markInteraction();
    if (pointers.size === 2) {
      dragging = false;
      pinchStart = Math.max(1, pinchDistance());
      pinchZoom = zoomTarget;
    } else if (pointers.size === 1 && !planMode) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
    ctx.invalidate();
  }

  function onPointerMove(event: PointerEvent) {
    const known = pointers.get(event.pointerId);
    if (!known) return;
    known.x = event.clientX;
    known.y = event.clientY;
    if (pointers.size === 2) {
      zoomTarget = clampZoom(pinchZoom * (pinchDistance() / pinchStart));
      zoom = zoomTarget;
      markInteraction();
      ctx.invalidate();
      return;
    }
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    setOrbit(userAzimuth + dx * RAD_PER_PX, userPolar - dy * POLAR_PER_PX);
    azimuth = azimuthTarget;
    polar = polarTarget;
    markInteraction();
    ctx.invalidate();
  }

  function onPointerUp(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;
    // Après un pincement, le doigt qui reste ne fait pas tourner l'objet d'un coup.
    dragging = false;
    try {
      view?.element.releasePointerCapture(event.pointerId);
    } catch {
      // Capture déjà perdue.
    }
    markInteraction();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!display || event.altKey || event.ctrlKey || event.metaKey) return;
    // Les touches vont à la scène seulement quand c'est elle qui a le focus.
    if (event.target !== view?.element) return;
    switch (event.key) {
      case "ArrowLeft":
        turn(-TURN_STEP);
        break;
      case "ArrowRight":
        turn(TURN_STEP);
        break;
      case "ArrowUp":
        markInteraction();
        setOrbit(userAzimuth, userPolar - TILT_STEP);
        if (ctx.reduced) polar = polarTarget;
        ctx.invalidate();
        break;
      case "ArrowDown":
        markInteraction();
        setOrbit(userAzimuth, userPolar + TILT_STEP);
        if (ctx.reduced) polar = polarTarget;
        ctx.invalidate();
        break;
      case "+":
      case "=":
        command({ type: "zoom", step: 1 });
        break;
      case "-":
        command({ type: "zoom", step: -1 });
        break;
      case "Home":
        command({ type: "reset" });
        break;
      default:
        return;
    }
    // Les flèches tournent l'objet, elles ne font pas défiler la page.
    event.preventDefault();
  }

  function onViewCommand(event: Event) {
    const detail = (event as CustomEvent<StudioViewCommand>).detail;
    if (detail) command(detail);
  }

  // ── Props ──

  function syncView(next: StudioSceneProps) {
    const plan = next.view === "plan";
    if (plan === planMode) return;
    planMode = plan;
    if (plan) {
      azimuthTarget = 0;
      polarTarget = PLAN_POLAR;
    } else {
      azimuthTarget = userAzimuth;
      polarTarget = userPolar;
    }
    if (ctx.reduced) {
      azimuth = azimuthTarget;
      polar = polarTarget;
    }
  }

  function clearAnchors() {
    if (anchorsCleared) return;
    anchorsCleared = true;
    lastAnchors = "";
    props?.onAnchors?.([]);
  }

  function reportAnchors(rect: DOMRectReadOnly, now: number) {
    if (!props?.onAnchors) return;
    if (!display || !props.exploded || !display.separate) {
      clearAnchors();
      return;
    }
    if (now - lastAnchorAt < ANCHOR_INTERVAL_MS) return;
    lastAnchorAt = now;
    const [, minY, , maxX, maxY] = display.built.mesh.bbox;
    const cy = (minY + maxY) / 2;
    const anchors: StudioBandAnchor[] = [];
    let from = 0;
    display.built.bands.forEach((band, index) => {
      const mid = (from + band.toMm) / 2 + explodeOffset(index, EXPLODE_GAP);
      from = band.toMm;
      // Objet (x, y, z) → three (x, z, −y), puis vers le pixel de la vue.
      projector.set(maxX, mid, -cy).project(camera);
      anchors.push({
        x: Math.round(((projector.x + 1) / 2) * rect.width),
        y: Math.round(((1 - projector.y) / 2) * rect.height),
      });
    });
    const key = JSON.stringify(anchors);
    if (key === lastAnchors) return;
    lastAnchors = key;
    anchorsCleared = false;
    props.onAnchors(anchors);
  }

  return {
    // Le poster SSR (le dessin 2D exact) reste tant qu'aucun maillage n'est
    // arrivé, et quand la vue 2D recouvre la 3D (rien à dessiner derrière).
    get holdPoster() {
      return !display || props?.hidden === true;
    },

    async mount(_ctx, descriptor) {
      view = descriptor;
      props = descriptor.props;
      lastReprint = props.reprint ?? 0;
      planMode = props.view === "plan";
      if (planMode) {
        azimuth = azimuthTarget = 0;
        polar = polarTarget = PLAN_POLAR;
      }
      applyTheme(ctx.theme);
      const element = descriptor.element;
      element.addEventListener("pointerdown", onPointerDown);
      element.addEventListener("pointermove", onPointerMove);
      element.addEventListener("pointerup", onPointerUp);
      element.addEventListener("pointercancel", onPointerUp);
      element.addEventListener("keydown", onKeyDown);
      element.addEventListener(STUDIO_VIEW_EVENT, onViewCommand);
      disposers.push(
        () => element.removeEventListener("pointerdown", onPointerDown),
        () => element.removeEventListener("pointermove", onPointerMove),
        () => element.removeEventListener("pointerup", onPointerUp),
        () => element.removeEventListener("pointercancel", onPointerUp),
        () => element.removeEventListener("keydown", onKeyDown),
        () => element.removeEventListener(STUDIO_VIEW_EVENT, onViewCommand),
      );
      report("building", {}, true);
      lastChangeAt = performance.now();
      request("display");
      // Montée une fois le premier maillage (ou son échec) arrivé : le Stage ne
      // dessine rien d'inachevé et une vignette (bake) a son objet.
      await firstMesh;
    },

    update(next) {
      const before = props;
      props = next;
      if (!before) return;
      syncView(next);
      if (next.reprint !== undefined && next.reprint !== lastReprint) {
        lastReprint = next.reprint;
        pendingReprint = true;
      }
      const buildChanged =
        next.config !== before.config ||
        next.texts !== before.texts ||
        next.locale !== before.locale;
      if (buildChanged) onConfigChanged();
      else if (next.exploded !== before.exploded) {
        window.clearTimeout(settleTimer);
        request("display");
      }
      if (next.simulate !== before.simulate) {
        simulating = Boolean(next.simulate) && !ctx.reduced;
        lastSimAt = 0;
      }
      // Pendant la simulation, la hauteur vient de l'horloge, pas du curseur.
      if (!simulating) applyCut();
      ctx.invalidate();
    },

    render(current: StageContext, frame: ViewFrame) {
      const d = display;
      if (!d || !props || props.hidden === true) return false;
      if (current.theme !== theme) applyTheme(current.theme);
      const now = frame.time;
      const dt = Math.min(frame.dt, 0.05);
      const animate = !current.reduced;
      let again = dragging;

      // Réimpression : le front monte, puis l'ancien objet disparaît.
      if (reprintStart !== NONE && outgoing) {
        if (reprintStart === PENDING) reprintStart = now;
        const progress = animate ? (now - reprintStart) / REPRINT_S : 1;
        const front = reprintFront(
          progress,
          Math.max(d.built.heightMm, outgoing.built.heightMm),
        );
        d.material.uniforms.uReprintZ.value = front;
        outgoing.material.uniforms.uReprintZ.value = front;
        if (progress >= 1) {
          disposeDisplay(outgoing);
          outgoing = null;
          reprintStart = NONE;
          d.material.uniforms.uReprintSide.value = 0;
          d.material.uniforms.uReprintActive.value = 0;
        } else again = true;
      } else if (reprintStart !== NONE) {
        reprintStart = NONE;
      }

      // Vague de couleur : le front monte de la base vers le sommet.
      if (rippleStart !== NONE) {
        if (rippleStart === PENDING) rippleStart = now;
        const progress = animate ? (now - rippleStart) / RIPPLE_S : 1;
        const u = d.material.uniforms;
        if (progress >= 1) {
          rippleStart = NONE;
          u.uRippleActive.value = 0;
          u.uRippleZ.value = RIPPLE_OFF;
        } else {
          u.uRippleActive.value = 1;
          u.uRippleZ.value = rippleFront(progress, d.built.heightMm);
          again = true;
        }
      }

      // Simulation d'impression (vue « Couches »).
      const sim = props.simulate;
      if (sim && simulating && animate) {
        const state = simulationState({
          elapsedMs: performance.now() - sim.startedAt,
          speed: sim.speed,
          printMinutes: props.printMinutes ?? 60,
          heightMm: d.built.heightMm,
        });
        applyCut(state.done ? null : state.z);
        if (state.done) d.material.uniforms.uHot.value = 0;
        const t = performance.now();
        if (state.done || t - lastSimAt >= SIM_INTERVAL_MS) {
          lastSimAt = t;
          props.onSimulate?.({
            z: state.z,
            layer: state.layer || layerAt(state.z),
            done: state.done,
          });
        }
        if (state.done) simulating = false;
        else again = true;
      }

      // Caméra : amortie, jamais d'inertie en mouvement réduit.
      if (animate) {
        const k = 1 - Math.exp(-dt * 12);
        azimuth += angleGap(azimuth, azimuthTarget) * k;
        polar += (polarTarget - polar) * k;
        zoom += (zoomTarget - zoom) * k;
        if (
          Math.abs(angleGap(azimuth, azimuthTarget)) > 0.0005 ||
          Math.abs(polarTarget - polar) > 0.0005 ||
          Math.abs(zoomTarget - zoom) > 0.0005
        )
          again = true;
        else {
          azimuth = azimuthTarget;
          polar = polarTarget;
          zoom = zoomTarget;
        }
        const idle = performance.now() / 1000 - lastInteractionAt;
        if (
          props.autoRotate === true &&
          current.capability === 2 &&
          !planMode &&
          !dragging
        ) {
          if (idle > AUTO_RESUME_S) {
            userAzimuth += AUTO_ROTATE * dt;
            azimuth = azimuthTarget = userAzimuth;
          }
          again = true;
        }
      } else {
        azimuth = azimuthTarget;
        polar = polarTarget;
        zoom = zoomTarget;
      }

      // Cadrage : l'objet (éclaté compris) dans 74 % de la hauteur de la vue.
      const rect = frame.rect;
      const aspect = rect.width / Math.max(1, rect.height);
      const box = d.built.mesh.bbox;
      const width = box[3] - box[0];
      const depth = box[4] - box[1];
      const radius = Math.max(width, depth) / 2;
      const height = props.exploded
        ? explodedHeight(d.built.heightMm, d.built.bands.length, EXPLODE_GAP)
        : d.built.heightMm;
      const cx = (box[0] + box[3]) / 2;
      const cy = (box[1] + box[4]) / 2;
      const planBlend = planMode ? 1 : clamp(1 - polar / POLAR_START, 0, 1);
      const distance =
        (planBlend > 0.5
          ? fitDistancePlan({ width, depth, aspect })
          : fitDistance({ height, radius, aspect })) / zoom;
      target.set(cx, planBlend > 0.5 ? 0 : height / 2, -cy);
      const [px, py, pz] = orbitPosition(
        [target.x, target.y, target.z],
        distance,
        azimuth,
        polar,
      );
      camera.aspect = aspect;
      camera.near = distance * 0.05;
      camera.far = distance * 12;
      camera.position.set(px, py, pz);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      current.renderer.render(scene, camera);
      reportAnchors(rect, performance.now());
      return again;
    },

    dispose() {
      disposed = true;
      window.clearTimeout(settleTimer);
      window.clearTimeout(slowTimer);
      resolveFirst?.();
      for (const off of disposers.splice(0)) off();
      if (display) disposeDisplay(display);
      if (outgoing) disposeDisplay(outgoing);
      display = null;
      outgoing = null;
      grid.dispose();
      scene.clear();
    },
  };
};

export default create;
