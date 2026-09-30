// Scène « product-viewer » (brief « Strates », §4.4, §7.9) : le fichier ORIGINAL
// d'un produit (STL, ou GLB), rendu en temps réel sur le papier de la page, que
// l'on fait TOURNER. Rien d'autre.
//
// Pourquoi cette retenue : le Vase spirale est le modèle de Ian, publié sous
// Creative Commons BY-ND 4.0 (aucune œuvre dérivée, §1.5). On le montre et on le
// fait tourner : jamais de changement de géométrie, de taille ni de motif, donc
// ici ni zoom ni panoramique, ni plan de coupe, ni matériau d'impression
// (celui de print-hero et du Studio), ni ligne de couche, ni teinte hors des
// couleurs réellement vendues (la couleur arrive par les props, depuis la
// pastille choisie à l'achat). Les seules opérations sur la géométrie sont
// rigides et d'affichage : redresser l'objet (quel que soit l'axe « haut » de
// l'export), le poser sur le plateau, lisser les NORMALES (l'éclairage, pas les
// sommets). Aucun sommet n'est déplacé, ajouté ni retiré.
//
// Communication avec le DOM (product-viewer.tsx) : le DOM passe des props
// (couleur, autorotation) et un rappel d'état (chargement du STL) ; les boutons
// « Tourner » émettent un événement sur l'élément de la vue, que la scène écoute
// comme elle écoute le pointeur et le clavier (vue interactive, §4.5).
//
// Chargement différé (§7.9) : le STL (≈ 2,2 Mo, servi sans Content-Length) n'est
// demandé que lorsque la section approche (marge 100 % de l'écran). Tant qu'il
// n'est pas prêt, `holdPoster` garde la photo SSR à l'écran ; en cas d'échec, la
// photo reste et le DOM l'annonce.
import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
} from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import {
  VIEWER_TURN_EVENT,
  type ProductViewerProps,
  type ViewerState,
  type ViewerTurnDetail,
} from "@/components/catalog/viewer-props";
import type { StageContext, StageScene, StageTheme, ViewFrame } from "../types";
import type { StageViewDescriptor } from "@/lib/motion-bridge/types";

// ── Réglages (§2.4 : longue focale, élévation 20–25°, lumière du nord-ouest) ──

const FOV = 20;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Polaire bornée 60–95° (depuis le zénith) : on ne passe ni au-dessus ni sous le plateau. */
const POLAR_MIN = rad(60);
const POLAR_MAX = rad(95);
const POLAR_START = rad(68);
const AZIMUTH_START = rad(-28);
/** Un cran de flèche ou de bouton « Tourner ». */
const TURN_STEP = rad(15);
const POLAR_STEP = rad(4);
/** Autorotation lente : 0,6 tr/min, en rad/s. */
const AUTO_ROTATE = (0.6 / 60) * 2 * Math.PI;
/** Reprise de l'autorotation après une interaction (s). */
const AUTO_RESUME_S = 2.5;
const RAD_PER_PX = rad(0.5);
const POLAR_PER_PX = rad(0.3);
/** La pièce occupe 74 % de la hauteur de la vue et au plus 66 % de sa largeur. */
const FILL_HEIGHT = 0.74;
const FILL_WIDTH = 0.66;
const PROGRESS_INTERVAL_MS = 250;

// ── Fonctions pures (testées : product-viewer.test.ts) ────────────────────────

export type UpAxis = "x" | "y" | "z";

/**
 * Axe « haut » probable d'un export, d'après sa boîte englobante. Les STL de
 * trancheur sont Z vers le haut (repli), les glTF Y vers le haut ; une pièce
 * nettement plus haute que large (un vase de 79 × 79 × 209 mm) se reconnaît à
 * son axe le plus long, quelle que soit la convention de l'export.
 */
export function upAxisFor(size: { x: number; y: number; z: number }): UpAxis {
  const axes: [UpAxis, number][] = [
    ["x", size.x],
    ["y", size.y],
    ["z", size.z],
  ];
  axes.sort((a, b) => b[1] - a[1]);
  const [longest, second] = axes;
  return longest[1] > second[1] * 1.25 ? longest[0] : "z";
}

export function clampPolar(polar: number): number {
  return Math.min(POLAR_MAX, Math.max(POLAR_MIN, polar));
}

/**
 * Distance de la caméra à la cible pour que la pièce (hauteur, rayon de
 * l'empreinte) tienne dans la vue, à son aspect, à la focale donnée.
 */
export function fitDistance(o: {
  height: number;
  radius: number;
  aspect: number;
  fovDeg: number;
}): number {
  const tan = Math.tan(rad(o.fovDeg) / 2);
  const byHeight = o.height / FILL_HEIGHT / 2 / tan;
  const byWidth =
    (o.radius * 2) / FILL_WIDTH / 2 / (tan * Math.max(0.2, o.aspect));
  return Math.max(byHeight, byWidth);
}

// ── Textures procédurales (aucun fichier à télécharger) ──────────────────────

/** Disque flou d'alpha décroissant, blanc : la teinte vient du matériau. */
function radialAlphaTexture(stops: [number, number][]): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  for (const [at, alpha] of stops)
    gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// ── Scène ────────────────────────────────────────────────────────────────────

const create = (
  ctx: StageContext,
): StageScene<ProductViewerProps> & { holdPoster: boolean } => {
  const scene = new Scene();
  scene.environment = ctx.envMap;
  scene.environmentIntensity = 0.6;
  // Lumière du nord-ouest (convention d'estompage suisse : en haut à gauche).
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 1.4, 0.8).normalize().multiplyScalar(400);
  scene.add(sun);

  const pivot = new Group();
  scene.add(pivot);
  const camera = new PerspectiveCamera(FOV, 1, 10, 5000);

  // Cyclorama (un sol sans horizon : une tache claire qui s'évanouit dans le
  // papier) et ombre de contact précalculée (texture canvas, §2.4).
  const floorTexture = radialAlphaTexture([
    [0, 0.6],
    [0.55, 0.28],
    [1, 0],
  ]);
  const shadowTexture = radialAlphaTexture([
    [0, 0.5],
    [0.5, 0.22],
    [1, 0],
  ]);
  const flat = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const floorMaterial = new MeshBasicMaterial({
    map: floorTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const floor = new Mesh(flat, floorMaterial);
  floor.renderOrder = -2;
  const shadow = new Mesh(flat, shadowMaterial);
  shadow.renderOrder = -1;
  floor.visible = false;
  shadow.visible = false;
  scene.add(floor, shadow);

  // Matériau PBR simple : la couleur est celle d'une bobine vendue.
  const material = new MeshStandardMaterial({
    color: new Color("#ddd9d0"),
    roughness: 0.55,
    metalness: 0,
  });

  // ── État ──
  let view: StageViewDescriptor<ProductViewerProps> | null = null;
  let props: ProductViewerProps | null = null;
  let theme: StageTheme | null = null;
  let disposed = false;
  let loadStarted = false;
  let state: ViewerState = "idle";
  let received = 0;
  let total: number | null = null;
  let lastProgressAt = 0;
  let abort: AbortController | null = null;
  let observer: IntersectionObserver | null = null;
  let model: Object3D | null = null;
  const ownedGeometries: BufferGeometry[] = [];
  const target = new Vector3();
  let modelHeight = 1;
  let modelRadius = 1;

  let azimuth = AZIMUTH_START;
  let azimuthTarget = AZIMUTH_START;
  let polar = POLAR_START;
  let spin = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveAt = 0;
  let lastInteractionAt = Number.NEGATIVE_INFINITY;
  const disposers: (() => void)[] = [];

  const report = (next: ViewerState, force = false) => {
    const now = performance.now();
    if (!force && next === state && now - lastProgressAt < PROGRESS_INTERVAL_MS)
      return;
    state = next;
    lastProgressAt = now;
    props?.onStatus?.({ state, receivedBytes: received, totalBytes: total });
  };

  function applyTheme(next: StageTheme) {
    theme = next;
    floorMaterial.color.set(next.iso);
    shadowMaterial.color.set(next.ink);
  }

  function applyColor() {
    if (props) material.color.set(props.color);
  }

  // ── Chargement ──

  /** Lit le corps de la réponse en comptant les octets (Content-Length s'il existe). */
  async function download(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const announced = Number(response.headers.get("content-length"));
    total = Number.isFinite(announced) && announced > 0 ? announced : null;
    if (!response.body) return response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      report("loading");
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  }

  /** Redresse, centre sur l'axe vertical et pose le modèle sur le plateau (y = 0). */
  function place(object: Object3D, up: UpAxis | null) {
    const holder = new Group();
    holder.add(object);
    // Rotation d'axe seulement : Z haut → Y haut (−90° autour de X), X haut → Y.
    const axis =
      up ?? upAxisFor(new Box3().setFromObject(object).getSize(new Vector3()));
    if (axis === "z") object.rotation.x = -Math.PI / 2;
    else if (axis === "x") object.rotation.z = Math.PI / 2;
    holder.updateMatrixWorld(true);
    const box = new Box3().setFromObject(holder);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    object.position.set(-center.x, -box.min.y, -center.z);
    modelHeight = size.y || 1;
    modelRadius = Math.max(size.x, size.z) / 2 || 1;
    return holder;
  }

  async function loadModel(url: string, signal: AbortSignal) {
    const buffer = await download(url, signal);
    if (signal.aborted) return null;
    const extension = url.split("?")[0].split(".").pop()?.toLowerCase();
    if (extension === "glb" || extension === "gltf") {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().parseAsync(buffer, "");
      gltf.scene.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        // Une seule matière (la couleur vendue) : les textures de l'export ne
        // sont pas utilisées, donc jamais chargées par le viewer.
        mesh.material = material;
        ownedGeometries.push(mesh.geometry);
      });
      // glTF : Y vers le haut par convention, rien à redresser.
      return place(gltf.scene, "y");
    }
    const parsed = new STLLoader().parse(buffer);
    if (parsed.getAttribute("position")?.count === 0)
      throw new Error("STL vide");
    // Normales adoucies pour les courbes douces, nettes aux arêtes vives (45°) ;
    // les positions sont recopiées telles quelles.
    const geometry = toCreasedNormals(parsed, rad(45));
    parsed.dispose();
    ownedGeometries.push(geometry);
    return place(new Mesh(geometry, material), null);
  }

  async function startLoad() {
    if (loadStarted || disposed || !props) return;
    loadStarted = true;
    abort = new AbortController();
    const { signal } = abort;
    received = 0;
    total = null;
    report("loading", true);
    try {
      const holder = await loadModel(props.modelUrl, signal);
      if (!holder || disposed || signal.aborted) return;
      model = holder;
      pivot.add(holder);
      target.set(0, modelHeight * 0.5, 0);
      // Cyclorama et ombre calés sur l'empreinte réelle de la pièce.
      floor.scale.setScalar(modelRadius * 7);
      shadow.scale.setScalar(modelRadius * 2.9);
      // Ombre portée légèrement vers le sud-est : la lumière vient du nord-ouest.
      shadow.position.set(modelRadius * 0.14, 0.02, modelRadius * 0.08);
      floor.position.y = 0.01;
      floor.visible = true;
      shadow.visible = true;
      report("ready", true);
      ctx.invalidate();
    } catch (error) {
      if (signal.aborted || disposed) return;
      console.error("[product-viewer] modèle indisponible", error);
      // La photo reste à l'écran (holdPoster), le DOM annonce l'échec.
      report("error", true);
    }
  }

  // ── Interaction : rotation seulement ──

  function markInteraction() {
    lastInteractionAt = performance.now() / 1000;
  }

  function turnTo(step: number) {
    markInteraction();
    spin = 0;
    if (ctx.reduced) {
      azimuth += step;
      azimuthTarget = azimuth;
    } else {
      azimuthTarget = azimuth + step;
    }
    ctx.invalidate();
  }

  function onPointerDown(event: PointerEvent) {
    if (state !== "ready") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const hit = event.target;
    if (
      hit instanceof Element &&
      hit.closest("[data-no-orbit], button, a, input")
    )
      return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = performance.now();
    spin = 0;
    azimuthTarget = azimuth;
    markInteraction();
    try {
      view?.element.setPointerCapture(event.pointerId);
    } catch {
      // Pointeur déjà libéré : le glissé se terminera à pointerup.
    }
    ctx.invalidate();
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const now = performance.now();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    const dAz = dx * RAD_PER_PX;
    azimuth += dAz;
    azimuthTarget = azimuth;
    polar = clampPolar(polar - dy * POLAR_PER_PX);
    const dt = Math.max(1, now - lastMoveAt) / 1000;
    // Vitesse lissée, reprise à la relâche pour l'inertie.
    spin = spin * 0.6 + (dAz / dt) * 0.4;
    lastMoveAt = now;
    markInteraction();
    ctx.invalidate();
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      view?.element.releasePointerCapture(event.pointerId);
    } catch {
      // Capture déjà perdue.
    }
    // Un geste arrêté avant de lâcher ne doit pas être relancé.
    if (performance.now() - lastMoveAt > 90 || ctx.reduced) spin = 0;
    spin = Math.max(-6, Math.min(6, spin));
    markInteraction();
    ctx.invalidate();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (state !== "ready" || event.altKey || event.ctrlKey || event.metaKey)
      return;
    switch (event.key) {
      case "ArrowLeft":
        turnTo(-TURN_STEP);
        break;
      case "ArrowRight":
        turnTo(TURN_STEP);
        break;
      case "ArrowUp":
        polar = clampPolar(polar - POLAR_STEP);
        markInteraction();
        ctx.invalidate();
        break;
      case "ArrowDown":
        polar = clampPolar(polar + POLAR_STEP);
        markInteraction();
        ctx.invalidate();
        break;
      case "Home":
        azimuthTarget = AZIMUTH_START;
        azimuth = ctx.reduced ? AZIMUTH_START : azimuth;
        polar = POLAR_START;
        spin = 0;
        markInteraction();
        ctx.invalidate();
        break;
      default:
        return;
    }
    // Les flèches tournent l'objet, elles ne font pas défiler la page.
    event.preventDefault();
  }

  function onTurn(event: Event) {
    if (state !== "ready") return;
    const step = (event as CustomEvent<ViewerTurnDetail>).detail?.step;
    if (step === -1 || step === 1) turnTo(step * TURN_STEP);
  }

  return {
    // La photo SSR reste visible tant que le modèle n'est pas prêt (ou a échoué).
    get holdPoster() {
      return state !== "ready";
    },
    mount(_ctx, descriptor) {
      view = descriptor;
      props = descriptor.props;
      applyTheme(ctx.theme);
      applyColor();
      const element = descriptor.element;
      element.addEventListener("pointerdown", onPointerDown);
      element.addEventListener("pointermove", onPointerMove);
      element.addEventListener("pointerup", onPointerUp);
      element.addEventListener("pointercancel", onPointerUp);
      element.addEventListener("keydown", onKeyDown);
      element.addEventListener(VIEWER_TURN_EVENT, onTurn);
      disposers.push(
        () => element.removeEventListener("pointerdown", onPointerDown),
        () => element.removeEventListener("pointermove", onPointerMove),
        () => element.removeEventListener("pointerup", onPointerUp),
        () => element.removeEventListener("pointercancel", onPointerUp),
        () => element.removeEventListener("keydown", onKeyDown),
        () => element.removeEventListener(VIEWER_TURN_EVENT, onTurn),
      );
      // Le STL n'est demandé que lorsque la section approche (100 % de marge).
      if (!element.isConnected || typeof IntersectionObserver === "undefined") {
        void startLoad();
      } else {
        observer = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer?.disconnect();
            observer = null;
            void startLoad();
          },
          { rootMargin: "100% 0px" },
        );
        observer.observe(element);
      }
      // Le rappel d'état part dès maintenant : le DOM sait que la scène écoute.
      report("idle", true);
    },
    update(next) {
      props = next;
      applyColor();
      ctx.invalidate();
    },
    render(current: StageContext, frame: ViewFrame) {
      if (!model) return false;
      if (current.theme !== theme) applyTheme(current.theme);

      // Après un repos, dt est énorme : on borne pour ne pas « sauter ».
      const dt = Math.min(frame.dt, 0.05);
      const sinceInteraction = performance.now() / 1000 - lastInteractionAt;
      // Autorotation lente : mouvement complet, capacité C2, hors interaction.
      // En C1 la vue se fige en image au repos (bake), elle ne tourne donc pas.
      const autoRotate =
        current.capability === 2 &&
        !current.reduced &&
        props?.autoRotate === true;

      let again = dragging;
      if (!dragging) {
        if (!current.reduced && Math.abs(spin) > 0.02) {
          // Inertie du geste, amortie.
          azimuth += spin * dt;
          azimuthTarget = azimuth;
          spin *= Math.exp(-dt * 3.5);
          again = true;
        } else {
          spin = 0;
          const gap = azimuthTarget - azimuth;
          if (Math.abs(gap) > 0.0005) {
            // Crans des flèches et des boutons : rattrapage amorti.
            azimuth += gap * (1 - Math.exp(-dt * 12));
            again = true;
          } else {
            azimuth = azimuthTarget;
          }
          if (autoRotate) {
            if (!again && sinceInteraction > AUTO_RESUME_S) {
              azimuth += AUTO_ROTATE * dt;
              azimuthTarget = azimuth;
            }
            // Tourne, ou attend la reprise : dans les deux cas, une frame de plus.
            again = true;
          }
        }
      }
      pivot.rotation.y = azimuth;

      const rect = frame.rect;
      const aspect = rect.width / Math.max(1, rect.height);
      camera.aspect = aspect;
      const distance = fitDistance({
        height: modelHeight,
        radius: modelRadius,
        aspect,
        fovDeg: FOV,
      });
      camera.near = distance * 0.05;
      camera.far = distance * 6;
      camera.position.set(
        target.x,
        target.y + distance * Math.cos(polar),
        target.z + distance * Math.sin(polar),
      );
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      current.renderer.render(scene, camera);
      return again;
    },
    dispose() {
      disposed = true;
      // Scène libérée (contexte perdu, sortie de page) : le DOM repasse à la
      // photo et retire « Tourner », au lieu de garder un état « prêt » périmé.
      if (state !== "idle")
        props?.onStatus?.({
          state: "idle",
          receivedBytes: 0,
          totalBytes: null,
        });
      abort?.abort();
      observer?.disconnect();
      for (const off of disposers.splice(0)) off();
      for (const geometry of ownedGeometries) geometry.dispose();
      ownedGeometries.length = 0;
      flat.dispose();
      floorTexture.dispose();
      shadowTexture.dispose();
      floorMaterial.dispose();
      shadowMaterial.dispose();
      material.dispose();
      scene.clear();
      model = null;
    },
  };
};

export default create;
