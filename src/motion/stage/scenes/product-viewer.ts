// Scène « product-viewer » (brief « Strates », §4.4, §7.9) : le fichier ORIGINAL
// d'un produit (STL, ou GLB), rendu en temps réel sur le papier de la page, que
// l'on fait TOURNER. Rien d'autre.
//
// Pourquoi cette retenue : le Vase spirale est le modèle de Ian, publié sous
// Creative Commons BY-ND 4.0 (aucune œuvre dérivée, §1.5). On le montre et on le
// fait tourner : jamais de changement de géométrie, de taille ni de motif, donc
// ici ni zoom ni panoramique, ni plan de coupe, ni matériau d'impression
// (celui de print-hero et du Studio), ni ligne de couche, ni teinte hors des
// couleurs réellement vendues (les teintes arrivent par les props, depuis la
// pastille choisie à l'achat ; une bobine bi- ou tricolore co-extrudée est
// peinte en secteurs autour de la pièce, voir coextruded.ts, par couleurs de
// sommets : la géométrie ne bouge pas). Les seules opérations sur la géométrie sont
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
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Texture,
  type WebGLRenderTarget,
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
import { coextrudedBlend } from "./coextruded";

// ── Réglages (§2.4 : longue focale, élévation 20–25°, lumière du nord-ouest) ──

const FOV = 20;
const rad = (deg: number) => (deg * Math.PI) / 180;
/**
 * Polaire (depuis le zénith) bornée à 6–174° : on voit la pièce sous tous les
 * angles, du dessus comme du dessous (demande du 15.10.2026), sans passer
 * exactement par les pôles (la caméra y perdrait son « haut »).
 */
const POLAR_MIN = rad(6);
const POLAR_MAX = rad(174);
/** Sous le plateau, le sol et l'ombre s'effacent entre ces deux polaires. */
const FLOOR_FADE_FROM = rad(88);
const FLOOR_FADE_TO = rad(100);
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
const POLAR_PER_PX = rad(0.4);
/** La pièce occupe 74 % de la hauteur de la vue et au plus 66 % de sa largeur. */
const FILL_HEIGHT = 0.74;
const FILL_WIDTH = 0.66;
const PROGRESS_INTERVAL_MS = 250;

// ── Décor : une pièce meublée, la pièce vendue posée sur la table ─────────────
// La caméra tourne AUTOUR de la pièce (on voit la salle défiler), la pièce reste
// posée. Tout est à l'échelle réelle (salle « scaled to real world » : plateau à
// 0,78 m, dossiers à 1 m, plan de travail à 0,86 m ; le vase fait 21 cm) : on ne
// grossit jamais la pièce, ce serait mentir sur sa taille. Pour qu'elle domine
// l'image, la caméra s'en approche au grand angle : la salle s'éloigne derrière.
const DECOR_FOV = 50;
/** Première vue : depuis le bout de la table, vers la cuisine (fenêtre à gauche). */
const DECOR_AZIMUTH_START = rad(70);
/**
 * Polaire en décor : de 40° (plongée) à 84° (presque à hauteur de plateau). Plus
 * bas, la caméra traverserait le plateau ou les dossiers des chaises.
 */
const DECOR_POLAR_MIN = rad(40);
const DECOR_POLAR_MAX = rad(84);
const DECOR_POLAR_START = rad(78);
/** En décor, la pièce occupe 52 % de la hauteur de la vue (la salle autour). */
const DECOR_FILL = 0.52;
/** Lumière d'appoint côté fenêtre (le décor a ses baies vers −Z). */
const DECOR_SUN = new Vector3(0.25, 1.1, -1);

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

export function clampPolar(polar: number, decor = false): number {
  return decor
    ? Math.min(DECOR_POLAR_MAX, Math.max(DECOR_POLAR_MIN, polar))
    : Math.min(POLAR_MAX, Math.max(POLAR_MIN, polar));
}

/**
 * Échelle du fichier vers les mètres du décor : un STL de trancheur est en
 * millimètres (une pièce de plus de 5 « mètres » de haut l'est forcément), un
 * glTF en mètres.
 */
export function unitScaleFor(height: number): number {
  return height > 5 ? 0.001 : 1;
}

/** Distance de la caméra en décor : la pièce occupe DECOR_FILL de la hauteur. */
export function decorDistance(o: {
  height: number;
  radius: number;
  aspect: number;
  fovDeg: number;
}): number {
  const tan = Math.tan(rad(o.fovDeg) / 2);
  const byHeight = o.height / DECOR_FILL / 2 / tan;
  const byWidth = (o.radius * 2) / 0.5 / 2 / (tan * Math.max(0.2, o.aspect));
  return Math.max(byHeight, byWidth);
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
  /** Maillages de la pièce, à peindre quand la bobine est co-extrudée. */
  const meshes: Mesh[] = [];
  /** Teintes déjà peintes en couleurs de sommets (clé), pour ne pas repeindre. */
  let paintedKey: string | null = null;
  /** Décor chargé (la pièce y est posée), ou null : fond neutre de la page. */
  let decor: Object3D | null = null;
  const decorMaterials = new Set<Material>();
  const decorTextures = new Set<Texture>();
  let decorEnv: WebGLRenderTarget | null = null;
  /** Mètres par unité du fichier de la pièce (STL en mm : 0,001). */
  let unitScale = 1;
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

  /**
   * Teinte de la pièce. Une couleur : celle du matériau. Bobine co-extrudée (2 à
   * 3 teintes) : couleurs de sommets, calculées une fois par bobine depuis les
   * normales dans le repère de la pièce posée (le secteur colle donc à la pièce
   * quand elle tourne, comme sur l'objet imprimé).
   */
  function applyColor() {
    const tints = props?.colors.length ? props.colors : null;
    if (!tints) return;
    if (tints.length === 1) {
      if (material.vertexColors) {
        material.vertexColors = false;
        material.needsUpdate = true;
      }
      material.color.set(tints[0]);
      return;
    }
    if (!model) {
      // Pas encore de pièce : la première teinte en attendant le modèle.
      material.color.set(tints[0]);
      return;
    }
    const key = tints.join(",");
    if (key !== paintedKey) {
      paint(tints.map((hex) => new Color(hex)));
      paintedKey = key;
    }
    material.color.set(0xffffff);
    if (!material.vertexColors) {
      material.vertexColors = true;
      material.needsUpdate = true;
    }
  }

  function paint(tints: Color[]) {
    if (!model) return;
    // Mélange (dessus, dessous) : la moyenne des teintes, en linéaire.
    const mix = new Color(0, 0, 0);
    for (const tint of tints) mix.add(tint);
    mix.multiplyScalar(1 / tints.length);
    model.updateMatrixWorld(true);
    const toModel = new Matrix4().copy(model.matrixWorld).invert();
    const normalMatrix = new Matrix3();
    const normal = new Vector3();
    const color = new Color();
    for (const mesh of meshes) {
      const normals = mesh.geometry.getAttribute("normal");
      if (!normals) continue;
      normalMatrix.getNormalMatrix(
        new Matrix4().multiplyMatrices(toModel, mesh.matrixWorld),
      );
      const out = new Float32Array(normals.count * 3);
      for (let i = 0; i < normals.count; i++) {
        normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix);
        const blend = coextrudedBlend(
          normal.x,
          normal.y,
          normal.z,
          tints.length,
        );
        color
          .copy(tints[blend.a])
          .lerp(tints[blend.b], blend.t)
          .lerp(mix, blend.flat);
        out[i * 3] = color.r;
        out[i * 3 + 1] = color.g;
        out[i * 3 + 2] = color.b;
      }
      mesh.geometry.setAttribute("color", new BufferAttribute(out, 3));
    }
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
        meshes.push(mesh);
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
    const mesh = new Mesh(geometry, material);
    meshes.push(mesh);
    return place(mesh, null);
  }

  /**
   * Le décor (glTF + .bin + textures WebP, même origine) : matériaux sans
   * éclairage, la lumière est dans les textures, montrées telles quelles (pas de
   * tone mapping). Un échec n'empêche rien : la pièce garde le fond neutre.
   */
  async function loadDecor(url: string): Promise<Object3D | null> {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(url);
      gltf.scene.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        ownedGeometries.push(mesh.geometry);
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) {
          material.toneMapped = false;
          // Luminosité voulue par l'auteur (l'albédo servait aussi d'émission
          // sur Sketchfab) : scripts/optimize-decor.mjs l'écrit en extras.
          const brightness = Number(material.userData.brightness) || 1;
          (material as MeshBasicMaterial).color?.multiplyScalar(brightness);
          decorMaterials.add(material);
          const map = (material as MeshBasicMaterial).map;
          if (map) decorTextures.add(map);
        }
      });
      return gltf.scene;
    } catch (error) {
      console.error("[product-viewer] décor indisponible", error);
      return null;
    }
  }

  /** Pose la pièce sur le meuble du décor et éclaire-la avec la salle. */
  function placeInDecor(room: Object3D, anchor: readonly number[]) {
    decor = room;
    scene.add(room);
    unitScale = unitScaleFor(modelHeight);
    pivot.position.set(anchor[0], anchor[1], anchor[2]);
    pivot.scale.setScalar(unitScale);
    pivot.rotation.y = 0;
    target.set(anchor[0], anchor[1] + modelHeight * unitScale * 0.5, anchor[2]);
    // Reflets et ambiance de la salle elle-même, vue depuis la pièce : la
    // teinte du produit prend la lumière du décor, pas celle d'un studio.
    const generator = new PMREMGenerator(ctx.renderer);
    pivot.visible = false;
    decorEnv = generator.fromScene(scene, 0.03, 0.02, 30, {
      position: target,
    });
    pivot.visible = true;
    generator.dispose();
    scene.environment = decorEnv.texture;
    scene.environmentIntensity = 1;
    sun.intensity = 1.1;
    sun.position.copy(DECOR_SUN).normalize().multiplyScalar(20).add(target);
    sun.target.position.copy(target);
    scene.add(sun.target);
    camera.fov = DECOR_FOV;
    polar = DECOR_POLAR_START;
    azimuth = azimuthTarget = DECOR_AZIMUTH_START;
    floor.visible = false;
    // Ombre de contact sur le plateau (le décor n'a pas d'ombre pour un objet
    // qu'il ne connaissait pas).
    const radius = modelRadius * unitScale;
    shadow.scale.setScalar(radius * 2.9);
    shadow.position.set(
      anchor[0] + radius * 0.1,
      anchor[1] + 0.002,
      anchor[2] + radius * 0.06,
    );
    shadow.visible = true;
  }

  async function startLoad() {
    if (loadStarted || disposed || !props) return;
    loadStarted = true;
    abort = new AbortController();
    const { signal } = abort;
    received = 0;
    total = null;
    report("loading", true);
    const decorProps = props.decor;
    // Le décor se charge en même temps que le fichier de la pièce.
    const room = decorProps ? loadDecor(decorProps.url) : null;
    try {
      const holder = await loadModel(props.modelUrl, signal);
      const loadedRoom = room ? await room : null;
      if (!holder || disposed || signal.aborted) return;
      model = holder;
      pivot.add(holder);
      // Bobine co-extrudée choisie avant l'arrivée du modèle : on la peint maintenant.
      applyColor();
      if (loadedRoom && decorProps) {
        placeInDecor(loadedRoom, decorProps.anchor);
      } else {
        target.set(0, modelHeight * 0.5, 0);
        // Cyclorama et ombre calés sur l'empreinte réelle de la pièce.
        floor.scale.setScalar(modelRadius * 7);
        shadow.scale.setScalar(modelRadius * 2.9);
        // Ombre portée légèrement vers le sud-est : la lumière vient du nord-ouest.
        shadow.position.set(modelRadius * 0.14, 0.02, modelRadius * 0.08);
        floor.position.y = 0.01;
        floor.visible = true;
        shadow.visible = true;
      }
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
    polar = clampPolar(polar - dy * POLAR_PER_PX, decor !== null);
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
        polar = clampPolar(polar - POLAR_STEP, decor !== null);
        markInteraction();
        ctx.invalidate();
        break;
      case "ArrowDown":
        polar = clampPolar(polar + POLAR_STEP, decor !== null);
        markInteraction();
        ctx.invalidate();
        break;
      case "Home": {
        const start = decor ? DECOR_AZIMUTH_START : AZIMUTH_START;
        azimuthTarget = start;
        azimuth = ctx.reduced ? start : azimuth;
        polar = decor ? DECOR_POLAR_START : POLAR_START;
        spin = 0;
        markInteraction();
        ctx.invalidate();
        break;
      }
      default:
        return;
    }
    // Les flèches tournent l'objet, elles ne font pas défiler la page.
    event.preventDefault();
  }

  function preventDrag(event: Event) {
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
      // Aucun glisser natif (image, texte) dans la vue : il volerait le geste
      // d'orbite (pointercancel) et traînerait une vignette à l'écran.
      element.addEventListener("dragstart", preventDrag);
      disposers.push(
        () => element.removeEventListener("dragstart", preventDrag),
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
      const rect = frame.rect;
      const aspect = rect.width / Math.max(1, rect.height);
      camera.aspect = aspect;
      let distance: number;
      // Fond neutre : la pièce tourne sur elle-même devant la caméra. Décor : la
      // pièce reste posée et la caméra tourne autour (la salle défile derrière).
      let orbit = 0;
      if (decor) {
        distance = decorDistance({
          height: modelHeight * unitScale,
          radius: modelRadius * unitScale,
          aspect,
          fovDeg: DECOR_FOV,
        });
        orbit = azimuth;
        camera.near = 0.02;
        camera.far = 30;
      } else {
        pivot.rotation.y = azimuth;
        // Vue par-dessous : le sol (une tache claire) et l'ombre de contact
        // masqueraient la pièce, ils s'effacent.
        const below = Math.min(
          1,
          Math.max(
            0,
            (polar - FLOOR_FADE_FROM) / (FLOOR_FADE_TO - FLOOR_FADE_FROM),
          ),
        );
        floorMaterial.opacity = 1 - below;
        shadowMaterial.opacity = 1 - below;
        floor.visible = shadow.visible = below < 1;
        distance = fitDistance({
          height: modelHeight,
          radius: modelRadius,
          aspect,
          fovDeg: FOV,
        });
        camera.near = distance * 0.05;
        camera.far = distance * 6;
      }
      camera.position.set(
        target.x + distance * Math.sin(polar) * Math.sin(-orbit),
        target.y + distance * Math.cos(polar),
        target.z + distance * Math.sin(polar) * Math.cos(-orbit),
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
      meshes.length = 0;
      flat.dispose();
      floorTexture.dispose();
      shadowTexture.dispose();
      floorMaterial.dispose();
      shadowMaterial.dispose();
      material.dispose();
      for (const decorMaterial of decorMaterials) decorMaterial.dispose();
      for (const texture of decorTextures) texture.dispose();
      decorMaterials.clear();
      decorTextures.clear();
      decorEnv?.dispose();
      decorEnv = null;
      scene.clear();
      model = null;
      decor = null;
    },
  };
};

export default create;
