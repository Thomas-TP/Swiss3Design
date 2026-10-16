// Scène « paint-editor » : l'atelier 3D de « Sur mesure ». La pièce du visiteur
// posée sur le plateau de l'imprimante (256 mm, volume d'impression en filet),
// peinte zone par zone comme dans un trancheur : pinceau, triangle, remplissages,
// bandes de hauteur, gomme, mesure, « poser sur une face », coupe horizontale.
//
// Partage des rôles : le DOM (src/components/paint) possède le document
// (src/lib/paint3d/document.ts) et les panneaux ; la scène dessine le document,
// tient la caméra et applique les outils sous le pointeur (le rayon passe par la
// BVH du document, dans le repère du fichier). Elle relit ce qui a changé à
// chaque image (doc.drainChanges) : un trait de pinceau ne renvoie au GPU que la
// plage de triangles touchée.
//
// Rendu : triangles d'origine dans un maillage indexé (un triangle coupé par le
// pinceau y est replié en triangle nul), leurs feuilles dans un second maillage
// reconstruit à la demande. Couleurs par sommet : la teinte de l'emplacement,
// en secteurs autour de la pièce pour une bobine co-extrudée (coextruded.ts).
//
// Gestes : glisser depuis la pièce peint (outils de peinture) ; depuis le vide,
// tourne ; clic droit ou deux doigts : tourner / déplacer et zoomer ; molette :
// zoom vers le curseur ; Maj + pinceau : gomme.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { raycastBvh } from "@/lib/paint3d/bvh";
import {
  rotationBetween,
  multiply3,
  type PaintDocument,
} from "@/lib/paint3d/document";
import type {
  PaintEditorProps,
  PaintMeasure,
  ViewPreset,
} from "@/lib/paint3d/editor-contract";
import { forEachLeaf, isSplit, leafCount } from "@/lib/paint3d/selector";
import {
  fillRegion,
  paintHeightRange,
  paintSphere,
  paintTriangles,
} from "@/lib/paint3d/tools";
import type { StageViewDescriptor } from "@/lib/motion-bridge/types";
import type { StageContext, StageScene, StageTheme, ViewFrame } from "../types";
import { coextrudedBlend } from "./coextruded";

const rad = (deg: number) => (deg * Math.PI) / 180;
const FOV = 30;
const ORBIT_PER_PX = rad(0.45);
const ELEVATION_MAX = rad(89.5);
const VIEW_ANIMATION_S = 0.35;
/** Un glissé de moins de 5 px reste un clic (remplissage, hauteur, mesure). */
const CLICK_SLOP_PX = 5;

const PRESETS: Record<Exclude<ViewPreset, "fit">, [number, number]> = {
  iso: [rad(-55), rad(28)],
  front: [rad(-90), rad(8)],
  back: [rad(90), rad(8)],
  left: [rad(180), rad(8)],
  right: [rad(0), rad(8)],
  top: [rad(-90), ELEVATION_MAX],
  bottom: [rad(-90), -ELEVATION_MAX],
};

type Gesture =
  | { kind: "paint"; id: number }
  | { kind: "orbit"; id: number }
  | { kind: "pan"; id: number }
  | { kind: "click"; id: number; x: number; y: number }
  | { kind: "pinch"; distance: number; mid: [number, number] };

/** Coordonnées barycentriques (u, v, w) de p dans le triangle `c` (9 nombres). */
function barycentric(
  c: ArrayLike<number>,
  px: number,
  py: number,
  pz: number,
): [number, number, number] {
  const v0x = c[3] - c[0];
  const v0y = c[4] - c[1];
  const v0z = c[5] - c[2];
  const v1x = c[6] - c[0];
  const v1y = c[7] - c[1];
  const v1z = c[8] - c[2];
  const v2x = px - c[0];
  const v2y = py - c[1];
  const v2z = pz - c[2];
  const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
  const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
  const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const d20 = v2x * v0x + v2y * v0y + v2z * v0z;
  const d21 = v2x * v1x + v2y * v1y + v2z * v1z;
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-20) return [1 / 3, 1 / 3, 1 / 3];
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  return [1 - v - w, v, w];
}

/** Grille du plateau : un trait par centimètre, plus marqué tous les 5 cm. */
function plateTexture(theme: StageTheme, size: number): CanvasTexture {
  const px = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const g = canvas.getContext("2d")!;
  g.fillStyle = theme.dark ? "#26241f" : "#ebe7de";
  g.fillRect(0, 0, px, px);
  const perMm = px / size;
  for (let mm = 0; mm <= size; mm += 10) {
    const strong = mm % 50 === 0;
    g.strokeStyle = theme.dark
      ? strong
        ? "rgba(255,255,255,0.22)"
        : "rgba(255,255,255,0.09)"
      : strong
        ? "rgba(0,0,0,0.22)"
        : "rgba(0,0,0,0.08)";
    g.lineWidth = strong ? 2 : 1;
    const at = Math.round(mm * perMm) + 0.5;
    g.beginPath();
    g.moveTo(at, 0);
    g.lineTo(at, px);
    g.moveTo(0, at);
    g.lineTo(px, at);
    g.stroke();
  }
  g.strokeStyle = theme.dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
  g.lineWidth = 4;
  g.strokeRect(2, 2, px - 4, px - 4);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const create = (ctx: StageContext): StageScene<PaintEditorProps> => {
  const scene = new Scene();
  scene.environment = ctx.envMap;
  scene.environmentIntensity = 0.7;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 10000);
  camera.up.set(0, 0, 1);
  const headlight = new DirectionalLight(0xffffff, 1.3);
  const hemisphere = new HemisphereLight(0xffffff, 0x8a8478, 0.45);
  hemisphere.position.set(0, 0, 1);
  scene.add(headlight, headlight.target, hemisphere);

  // Matière d'un PLA mat : couleurs de sommets, deux faces (maillages ouverts).
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    side: DoubleSide,
  });
  const clipPlane = new Plane(new Vector3(0, 0, -1), 0);
  const clipPlanes = [clipPlane];

  const object = new Group();
  object.matrixAutoUpdate = false;
  scene.add(object);
  let baseGeometry: BufferGeometry | null = null;
  let overlayGeometry: BufferGeometry | null = null;
  const base = new Mesh(new BufferGeometry(), material);
  const overlay = new Mesh(new BufferGeometry(), material);
  base.frustumCulled = false;
  overlay.frustumCulled = false;
  object.add(base, overlay);

  // Plateau et volume d'impression.
  const plateMaterial = new MeshBasicMaterial({ toneMapped: false });
  const plate = new Mesh(new PlaneGeometry(1, 1), plateMaterial);
  plate.position.z = -0.05;
  const volumeMaterial = new LineBasicMaterial({
    transparent: true,
    opacity: 0.35,
  });
  const volume = new LineSegments(
    new EdgesGeometry(new BoxGeometry(1, 1, 1)),
    volumeMaterial,
  );
  scene.add(plate, volume);

  // Curseurs : anneau du pinceau, plans de hauteur, points de mesure.
  const cursorMaterial = new LineBasicMaterial({
    color: 0xffffff,
    depthTest: false,
    transparent: true,
  });
  const ringGeometry = new BufferGeometry().setFromPoints(
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new Vector3(Math.cos(a), Math.sin(a), 0);
    }),
  );
  const ring = new LineLoop(ringGeometry, cursorMaterial);
  ring.renderOrder = 10;
  ring.visible = false;
  const ringShadowMaterial = new LineBasicMaterial({
    color: 0x111111,
    depthTest: false,
    transparent: true,
    opacity: 0.6,
  });
  const ringShadow = new LineLoop(ringGeometry, ringShadowMaterial);
  ringShadow.renderOrder = 9;
  ringShadow.visible = false;
  const heightMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.28,
    side: DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const heightPlanes = [0, 1].map(() => {
    const plane = new Mesh(new CircleGeometry(1, 64), heightMaterial);
    plane.visible = false;
    plane.renderOrder = 8;
    return plane;
  });
  const measureMaterial = new MeshBasicMaterial({
    color: 0xe5231c,
    depthTest: false,
    toneMapped: false,
  });
  const measurePoints = [0, 1].map(() => {
    const dot = new Mesh(new SphereGeometry(1, 16, 12), measureMaterial);
    dot.visible = false;
    dot.renderOrder = 11;
    return dot;
  });
  const measureLine = new LineSegments(
    new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]),
    new LineBasicMaterial({ color: 0xe5231c, depthTest: false }),
  );
  measureLine.visible = false;
  measureLine.renderOrder = 11;
  scene.add(ring, ringShadow, ...heightPlanes, ...measurePoints, measureLine);

  // ── État ──
  let view: StageViewDescriptor<PaintEditorProps> | null = null;
  let props: PaintEditorProps | null = null;
  let doc: PaintDocument | null = null;
  let theme: StageTheme | null = null;
  let plateTex: CanvasTexture | null = null;
  let plateSize = 0;
  let colors = new Float32Array(0);
  let index = new Uint32Array(0);
  let inOverlay = new Uint8Array(0);
  let overlayDirty = false;
  let paletteKey = "";
  let tints: Color[][] = [];
  let transformVersion = -1;
  let rotation: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  /** Prévisualisation du remplissage : zone et couleur montrée. */
  let preview: {
    region: Uint32Array;
    mask: Uint8Array;
    seed: number;
    key: string;
  } | null = null;
  let measure: PaintMeasure | null = null;
  let ready = false;
  const disposers: (() => void)[] = [];

  // Caméra en orbite autour de `target`.
  const target = new Vector3();
  let distance = 200;
  let azimuth = PRESETS.iso[0];
  let elevation = PRESETS.iso[1];
  let animation: {
    from: [Vector3, number, number, number];
    to: [Vector3, number, number, number];
    start: number;
  } | null = null;
  let lastNonce = -1;
  let lastAspect = 1;

  // Pointeurs.
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: Gesture | null = null;
  let lastPaint: Vector3 | null = null;
  let hover: { x: number; y: number } | null = null;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const worldMatrix = new Matrix4();
  const inverseMatrix = new Matrix4();

  // ── Couleurs ──

  function setPalette(palette: readonly (readonly string[])[]) {
    const key = palette.map((p) => p.join("+")).join(",");
    if (key === paletteKey) return false;
    paletteKey = key;
    tints = palette.map((hexes) =>
      (hexes.length ? hexes : ["#ddd9d0"]).map((hex) => new Color(hex)),
    );
    if (tints.length === 0) tints = [[new Color("#ddd9d0")]];
    return true;
  }

  const scratch = new Color();
  const white = new Color(1, 1, 1);

  /** Couleur (linéaire) d'un état sous une normale du fichier. */
  function colorOf(
    state: number,
    nx: number,
    ny: number,
    nz: number,
    out: Float32Array,
    o: number,
    previewing: boolean,
  ) {
    const slot = Math.min(tints.length - 1, Math.max(0, state - 1));
    const tint = tints[slot];
    if (tint.length === 1) scratch.copy(tint[0]);
    else {
      const r = rotation;
      // Normale tournée sur le plateau (Z en haut), puis repère Y en haut du mélange.
      const wx = r[0] * nx + r[1] * ny + r[2] * nz;
      const wy = r[3] * nx + r[4] * ny + r[5] * nz;
      const wz = r[6] * nx + r[7] * ny + r[8] * nz;
      const blend = coextrudedBlend(wx, wz, -wy, tint.length);
      scratch.copy(tint[blend.a]).lerp(tint[blend.b], blend.t);
      if (blend.flat > 0) {
        const mix = new Color(0, 0, 0);
        for (const t of tint) mix.add(t);
        mix.multiplyScalar(1 / tint.length);
        scratch.lerp(mix, blend.flat);
      }
    }
    if (previewing) scratch.lerp(white, 0.2);
    out[o] = scratch.r;
    out[o + 1] = scratch.g;
    out[o + 2] = scratch.b;
  }

  function previewState(): number {
    return props ? (props.tool === "erase" ? 0 : props.slot + 1) : 0;
  }

  function writeBaseColors(t: number) {
    if (!doc) return;
    const node = doc.node(t);
    const previewing = preview?.mask[t] === 1;
    const state = previewing ? previewState() : isSplit(node) ? 0 : node;
    const n = doc.cornerNormals;
    for (let i = 0; i < 3; i++) {
      const o = t * 9 + i * 3;
      colorOf(state, n[o], n[o + 1], n[o + 2], colors, o, previewing);
    }
  }

  function rebuildOverlay() {
    overlayDirty = false;
    if (!doc) return;
    let leaves = 0;
    for (const t of doc.splitTriangles()) {
      if (preview?.mask[t] === 1) continue;
      leaves += leafCount(doc.node(t));
    }
    const positions = new Float32Array(leaves * 9);
    const normals = new Float32Array(leaves * 9);
    const leafColors = new Float32Array(leaves * 9);
    let o = 0;
    const n = doc.cornerNormals;
    for (const t of doc.splitTriangles()) {
      if (preview?.mask[t] === 1) continue;
      const corners = doc.corners(t);
      const no = t * 9;
      forEachLeaf(doc.node(t), corners, (leaf, state) => {
        for (let i = 0; i < 3; i++) {
          const x = leaf[i * 3];
          const y = leaf[i * 3 + 1];
          const z = leaf[i * 3 + 2];
          positions[o] = x;
          positions[o + 1] = y;
          positions[o + 2] = z;
          const [u, v, w] = barycentric(corners, x, y, z);
          let nx = u * n[no] + v * n[no + 3] + w * n[no + 6];
          let ny = u * n[no + 1] + v * n[no + 4] + w * n[no + 7];
          let nz = u * n[no + 2] + v * n[no + 5] + w * n[no + 8];
          const length = Math.hypot(nx, ny, nz) || 1;
          nx /= length;
          ny /= length;
          nz /= length;
          normals[o] = nx;
          normals[o + 1] = ny;
          normals[o + 2] = nz;
          colorOf(state, nx, ny, nz, leafColors, o, false);
          o += 3;
        }
      });
    }
    overlayGeometry?.dispose();
    overlayGeometry = new BufferGeometry();
    overlayGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    overlayGeometry.setAttribute("normal", new BufferAttribute(normals, 3));
    overlayGeometry.setAttribute("color", new BufferAttribute(leafColors, 3));
    overlay.geometry = overlayGeometry;
  }

  /** Construit les maillages d'un nouveau document. */
  function adopt(next: PaintDocument) {
    doc = next;
    const count = next.triangleCount;
    colors = new Float32Array(count * 9);
    index = new Uint32Array(count * 3);
    inOverlay = new Uint8Array(count);
    for (let t = 0; t < count; t++) {
      if (next.isSplit(t)) inOverlay[t] = 1;
      else {
        index[t * 3] = t * 3;
        index[t * 3 + 1] = t * 3 + 1;
        index[t * 3 + 2] = t * 3 + 2;
      }
    }
    // Les changements d'avant (chargement) sont déjà dans les tampons.
    next.drainChanges(() => undefined);
    rotation = next.rotation;
    for (let t = 0; t < count; t++) writeBaseColors(t);
    baseGeometry?.dispose();
    baseGeometry = new BufferGeometry();
    baseGeometry.setAttribute(
      "position",
      new BufferAttribute(next.positions, 3),
    );
    baseGeometry.setAttribute(
      "normal",
      new BufferAttribute(next.cornerNormals, 3),
    );
    baseGeometry.setAttribute("color", new BufferAttribute(colors, 3));
    baseGeometry.setIndex(new BufferAttribute(index, 1));
    base.geometry = baseGeometry;
    preview = null;
    overlayDirty = true;
    transformVersion = -1;
    syncTransform();
    frame("iso", false);
  }

  /** Applique les changements du document depuis la dernière image. */
  function syncChanges() {
    if (!doc || !baseGeometry) return;
    let min = Infinity;
    let max = -Infinity;
    let indexMin = Infinity;
    let indexMax = -Infinity;
    doc.drainChanges((t) => {
      const split = doc!.isSplit(t);
      if (split || inOverlay[t]) overlayDirty = true;
      if (split !== (inOverlay[t] === 1)) {
        inOverlay[t] = split ? 1 : 0;
        index[t * 3] = split ? 0 : t * 3;
        index[t * 3 + 1] = split ? 0 : t * 3 + 1;
        index[t * 3 + 2] = split ? 0 : t * 3 + 2;
        indexMin = Math.min(indexMin, t);
        indexMax = Math.max(indexMax, t);
      }
      writeBaseColors(t);
      min = Math.min(min, t);
      max = Math.max(max, t);
    });
    if (min <= max) {
      const attribute = baseGeometry.getAttribute("color") as BufferAttribute;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(min * 9, (max - min + 1) * 9);
      attribute.needsUpdate = true;
    }
    if (indexMin <= indexMax) {
      const attribute = baseGeometry.getIndex()!;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(indexMin * 3, (indexMax - indexMin + 1) * 3);
      attribute.needsUpdate = true;
    }
  }

  function recolorAll() {
    if (!doc || !baseGeometry) return;
    for (let t = 0; t < doc.triangleCount; t++) writeBaseColors(t);
    const attribute = baseGeometry.getAttribute("color") as BufferAttribute;
    attribute.clearUpdateRanges();
    attribute.needsUpdate = true;
    overlayDirty = true;
  }

  function syncTransform() {
    if (!doc || doc.transformVersion === transformVersion) return;
    transformVersion = doc.transformVersion;
    const turned = doc.rotation.some((v, i) => v !== rotation[i]);
    rotation = doc.rotation;
    worldMatrix.fromArray(doc.worldMatrix());
    object.matrix.copy(worldMatrix);
    object.matrixWorldNeedsUpdate = true;
    inverseMatrix.copy(worldMatrix).invert();
    // Une bobine co-extrudée suit l'orientation : couleurs à refaire.
    if (turned && tints.some((tint) => tint.length > 1)) recolorAll();
    syncVolume();
  }

  function syncVolume() {
    if (!doc || !props) return;
    const size = props.plate;
    const bounds = doc.worldBounds();
    const fits =
      bounds.size[0] <= size + 0.01 &&
      bounds.size[1] <= size + 0.01 &&
      bounds.size[2] <= size + 0.01;
    volume.scale.set(size, size, size);
    volume.position.set(0, 0, size / 2);
    volumeMaterial.color.set(fits ? (theme?.iso ?? "#999") : "#e5231c");
    volumeMaterial.opacity = fits ? 0.35 : 0.9;
    plate.scale.set(size, size, 1);
    if (theme && (plateSize !== size || !plateTex)) {
      plateTex?.dispose();
      plateTex = plateTexture(theme, size);
      plateMaterial.map = plateTex;
      plateMaterial.needsUpdate = true;
      plateSize = size;
    }
  }

  function applyTheme(next: StageTheme) {
    theme = next;
    plateTex?.dispose();
    plateTex = null;
    plateSize = 0;
    syncVolume();
    cursorMaterial.color.set(next.dark ? 0xffffff : 0x111111);
  }

  // ── Caméra ──

  function fitDistance(aspect: number): number {
    if (!doc) return 200;
    const s = doc.worldBounds().size;
    const radius = Math.max(4, Math.hypot(s[0], s[1], s[2]) / 2);
    const half = rad(FOV / 2);
    const vertical = radius / Math.sin(half);
    const horizontal = radius / Math.sin(Math.atan(Math.tan(half) * aspect));
    return Math.max(vertical, horizontal) * 1.12;
  }

  function boundsCenter(): Vector3 {
    if (!doc) return new Vector3();
    const b = doc.worldBounds();
    return new Vector3(
      (b.min[0] + b.max[0]) / 2,
      (b.min[1] + b.max[1]) / 2,
      b.size[2] / 2,
    );
  }

  function frame(preset: ViewPreset, animate: boolean) {
    const [az, el] = preset === "fit" ? [azimuth, elevation] : PRESETS[preset];
    const to: [Vector3, number, number, number] = [
      boundsCenter(),
      fitDistance(lastAspect),
      az,
      el,
    ];
    if (!animate || ctx.reduced) {
      target.copy(to[0]);
      distance = to[1];
      azimuth = to[2];
      elevation = to[3];
      animation = null;
    } else {
      // Le plus court chemin autour de la pièce.
      let delta = (to[2] - azimuth) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      to[2] = azimuth + delta;
      animation = {
        from: [target.clone(), distance, azimuth, elevation],
        to,
        start: performance.now(),
      };
    }
    ctx.invalidate();
  }

  function placeCamera(aspect: number) {
    lastAspect = aspect;
    camera.aspect = aspect;
    const ce = Math.cos(elevation);
    camera.position.set(
      target.x + distance * ce * Math.cos(azimuth),
      target.y + distance * ce * Math.sin(azimuth),
      target.z + distance * Math.sin(elevation),
    );
    camera.lookAt(target);
    camera.near = Math.max(0.05, distance * 0.005);
    camera.far = distance * 30 + 2000;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    headlight.position
      .copy(camera.position)
      .add(new Vector3(0, 0, distance * 0.4));
    headlight.target.position.copy(target);
  }

  // ── Pointeur → pièce ──

  function rayFrom(clientX: number, clientY: number) {
    const rect = view!.element.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray;
  }

  /** Point de la pièce sous le pointeur (repère du plateau et du fichier). */
  function pick(clientX: number, clientY: number) {
    if (!doc) return null;
    const ray = rayFrom(clientX, clientY);
    const origin = ray.origin.clone().applyMatrix4(inverseMatrix);
    const direction = ray.direction.clone().transformDirection(inverseMatrix);
    const clipZ = props?.clipZ ?? null;
    const current = doc;
    const hit = raycastBvh(
      current.bvh,
      current.positions,
      [origin.x, origin.y, origin.z],
      [direction.x, direction.y, direction.z],
      clipZ === null
        ? undefined
        : (x, y, z) => current.worldZ(x, y, z) <= clipZ + 1e-6,
    );
    if (!hit) return null;
    const world = new Vector3(...hit.point).applyMatrix4(worldMatrix);
    return { hit, world, model: new Vector3(...hit.point) };
  }

  function showRing(world: Vector3, triangle: number) {
    if (!doc || !props) return;
    const n = doc.worldNormal(triangle);
    const normal = new Vector3(...n).normalize();
    const r = props.brushRadius;
    for (const loop of [ring, ringShadow]) {
      loop.position.copy(world).addScaledVector(normal, r * 0.03);
      loop.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
      loop.visible = true;
    }
    ring.scale.setScalar(r);
    ringShadow.scale.setScalar(r * 1.04);
  }

  function hideCursors() {
    ring.visible = ringShadow.visible = false;
    for (const plane of heightPlanes) plane.visible = false;
  }

  function showHeight(z: number) {
    if (!doc || !props) return;
    const b = doc.worldBounds();
    const radius = Math.hypot(b.size[0], b.size[1]) * 0.62 + 2;
    const tint = tints[Math.min(tints.length - 1, props.slot)]?.[0];
    heightMaterial.color.copy(tint ?? white);
    const cx = (b.min[0] + b.max[0]) / 2;
    const cy = (b.min[1] + b.max[1]) / 2;
    const levels =
      props.heightMode === "band"
        ? [z - props.bandHeight / 2, z + props.bandHeight / 2]
        : [z];
    heightPlanes.forEach((plane, i) => {
      plane.visible = i < levels.length;
      plane.position.set(cx, cy, levels[i] ?? 0);
      plane.scale.setScalar(radius);
    });
  }

  function clearPreview() {
    if (!preview || !doc) return;
    const old = preview;
    preview = null;
    let hadSplit = false;
    for (const t of old.region) {
      writeBaseColors(t);
      if (doc.isSplit(t)) hadSplit = true;
    }
    markAllColors(old.region);
    if (hadSplit) overlayDirty = true;
  }

  function markAllColors(region: Uint32Array) {
    if (!baseGeometry || region.length === 0) return;
    let min = Infinity;
    let max = -Infinity;
    for (const t of region) {
      if (t < min) min = t;
      if (t > max) max = t;
    }
    const attribute = baseGeometry.getAttribute("color") as BufferAttribute;
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(min * 9, (max - min + 1) * 9);
    attribute.needsUpdate = true;
  }

  function fillKey(): string {
    return props
      ? `${props.fillMode}:${props.fillAngle}:${props.slot}:${props.tool}:${props.clipZ}:${doc?.paintVersion}`
      : "";
  }

  /** Montre la zone que remplirait un clic sur `seed`. */
  function showFillPreview(seed: number) {
    if (!doc || !props) return;
    const key = fillKey();
    if (preview && preview.key === key && preview.mask[seed] === 1) return;
    clearPreview();
    const clipZ = props.clipZ;
    const current = doc;
    const region = fillRegion(
      current,
      seed,
      props.fillMode,
      props.fillAngle,
      clipZ === null
        ? undefined
        : (t) => {
            const c = current.corners(t);
            return current.worldZ(c[0], c[1], c[2]) <= clipZ;
          },
    );
    const mask = new Uint8Array(current.triangleCount);
    let hasSplit = false;
    for (const t of region) {
      mask[t] = 1;
      if (current.isSplit(t)) {
        hasSplit = true;
        // Le triangle coupé se montre entier, à la couleur du remplissage.
        index[t * 3] = t * 3;
        index[t * 3 + 1] = t * 3 + 1;
        index[t * 3 + 2] = t * 3 + 2;
      }
    }
    preview = { region, mask, seed, key };
    for (const t of region) writeBaseColors(t);
    markAllColors(region);
    if (hasSplit) {
      overlayDirty = true;
      baseGeometry!.getIndex()!.clearUpdateRanges();
      baseGeometry!.getIndex()!.needsUpdate = true;
    }
  }

  function restoreSplitIndices() {
    if (!doc || !baseGeometry) return;
    let changed = false;
    for (const t of doc.splitTriangles())
      if (index[t * 3 + 1] !== 0 || index[t * 3 + 2] !== 0) {
        index[t * 3] = index[t * 3 + 1] = index[t * 3 + 2] = 0;
        changed = true;
      }
    if (changed) {
      baseGeometry.getIndex()!.clearUpdateRanges();
      baseGeometry.getIndex()!.needsUpdate = true;
    }
  }

  function dropPreview() {
    if (!preview) return;
    clearPreview();
    restoreSplitIndices();
  }

  function updateHover(clientX: number, clientY: number) {
    if (!props || !doc) return;
    const tool = props.tool;
    const found = tool === "orbit" ? null : pick(clientX, clientY);
    props.onHover?.(found ? { z: found.world.z } : null);
    hideCursors();
    if (!found) {
      dropPreview();
      ctx.invalidate();
      return;
    }
    if (tool === "brush" || tool === "erase")
      showRing(found.world, found.hit.triangle);
    if (tool === "height") showHeight(found.world.z);
    if (tool === "fill") showFillPreview(found.hit.triangle);
    else dropPreview();
    ctx.invalidate();
  }

  // ── Outils ──

  function paintAt(
    found: NonNullable<ReturnType<typeof pick>>,
    erase: boolean,
  ) {
    if (!doc || !props) return;
    const state = erase || props.tool === "erase" ? 0 : props.slot + 1;
    if (props.tool === "triangle") {
      paintTriangles(doc, [found.hit.triangle], state);
      return;
    }
    const radius = props.brushRadius / doc.scale;
    const toCamera = camera.position.clone().sub(found.world).normalize();
    const facing = props.throughWalls
      ? null
      : doc.directionToModel(toCamera.x, toCamera.y, toCamera.z);
    // Trait continu : des touches tous les 0,4 rayon entre deux points.
    const points: Vector3[] = [];
    if (lastPaint) {
      const gap = lastPaint.distanceTo(found.world);
      const step = props.brushRadius * 0.4;
      if (gap > step && gap < props.brushRadius * 12) {
        const n = Math.min(60, Math.ceil(gap / step));
        for (let i = 1; i < n; i++)
          points.push(lastPaint.clone().lerp(found.world, i / n));
      }
    }
    points.push(found.world);
    for (const point of points) {
      const m = doc.toModel(point.x, point.y, point.z);
      paintSphere(doc, m, { state, radius, facing });
    }
    lastPaint = found.world.clone();
  }

  function clickTool(clientX: number, clientY: number) {
    if (!doc || !props) return;
    const found = pick(clientX, clientY);
    const tool = props.tool;
    if (tool === "measure") {
      if (!found) return;
      const p: [number, number, number] = [
        found.world.x,
        found.world.y,
        found.world.z,
      ];
      measure =
        !measure || measure.b
          ? { a: p, b: null, distance: null }
          : {
              a: measure.a,
              b: p,
              distance: Math.hypot(
                p[0] - measure.a[0],
                p[1] - measure.a[1],
                p[2] - measure.a[2],
              ),
            };
      syncMeasure();
      props.onMeasure?.(measure);
      return;
    }
    if (!found) return;
    const state = props.slot + 1;
    if (tool === "fill") {
      dropPreview();
      doc.beginStep();
      const clipZ = props.clipZ;
      const current = doc;
      paintTriangles(
        doc,
        fillRegion(
          doc,
          found.hit.triangle,
          props.fillMode,
          props.fillAngle,
          clipZ === null
            ? undefined
            : (t) => {
                const c = current.corners(t);
                return current.worldZ(c[0], c[1], c[2]) <= clipZ;
              },
        ),
        state,
      );
      if (doc.endStep()) props.onEdit?.();
    } else if (tool === "height") {
      const z = found.world.z;
      const [low, high] =
        props.heightMode === "above"
          ? [z, Infinity]
          : props.heightMode === "below"
            ? [-Infinity, z]
            : [z - props.bandHeight / 2, z + props.bandHeight / 2];
      doc.beginStep();
      paintHeightRange(doc, low, high, state);
      if (doc.endStep()) props.onEdit?.();
    } else if (tool === "lay") {
      // La face cliquée devient le dessous : sa normale pointe vers le plateau.
      const n = doc.worldNormal(found.hit.triangle);
      const turn = rotationBetween(n, [0, 0, -1]);
      doc.setTransform(multiply3(turn, doc.rotation), doc.scale);
      props.onEdit?.();
      frame("fit", true);
    }
    ctx.invalidate();
  }

  function syncMeasure() {
    const dot = Math.max(0.6, distance * 0.006);
    measurePoints[0].visible = measure !== null;
    measurePoints[1].visible = measure?.b != null;
    if (measure) {
      measurePoints[0].position.set(...measure.a);
      measurePoints[0].scale.setScalar(dot);
    }
    if (measure?.b) {
      measurePoints[1].position.set(...measure.b);
      measurePoints[1].scale.setScalar(dot);
      const positions = measureLine.geometry.getAttribute(
        "position",
      ) as BufferAttribute;
      positions.setXYZ(0, ...measure.a);
      positions.setXYZ(1, ...measure.b);
      positions.needsUpdate = true;
      measureLine.visible = true;
    } else measureLine.visible = false;
  }

  // ── Gestes ──

  function orbitBy(dx: number, dy: number) {
    azimuth -= dx * ORBIT_PER_PX;
    elevation = Math.max(
      -ELEVATION_MAX,
      Math.min(ELEVATION_MAX, elevation + dy * ORBIT_PER_PX),
    );
    animation = null;
  }

  function panBy(dx: number, dy: number) {
    const rect = view!.element.getBoundingClientRect();
    const perPx =
      (2 * distance * Math.tan(rad(FOV / 2))) / Math.max(1, rect.height);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, -dx * perPx).addScaledVector(up, dy * perPx);
    animation = null;
  }

  function zoomBy(factor: number, clientX?: number, clientY?: number) {
    const fit = fitDistance(lastAspect);
    const next = Math.max(fit * 0.04, Math.min(fit * 6, distance * factor));
    // Zoom vers le point visé sous le curseur.
    if (clientX !== undefined && clientY !== undefined && next < distance) {
      const found = pick(clientX, clientY);
      if (found) target.lerp(found.world, 1 - next / distance);
    }
    distance = next;
    animation = null;
  }

  function onPointerDown(event: PointerEvent) {
    if (!doc || !props) return;
    const element = event.target;
    if (
      element instanceof Element &&
      element.closest("[data-no-orbit], button, a, input")
    )
      return;
    try {
      view?.element.setPointerCapture(event.pointerId);
    } catch {
      // Pointeur déjà libéré.
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      // Deux doigts : la peinture en cours s'arrête, place au pincement.
      if (gesture?.kind === "paint" && doc.endStep()) props.onEdit?.();
      const [a, b] = [...pointers.values()];
      gesture = {
        kind: "pinch",
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        mid: [(a.x + b.x) / 2, (a.y + b.y) / 2],
      };
      hideCursors();
      return;
    }
    if (pointers.size > 2) return;
    const id = event.pointerId;
    const mouse = event.pointerType === "mouse";
    if (mouse && event.button === 2) {
      gesture = { kind: "orbit", id };
      return;
    }
    if (mouse && event.button === 1) {
      gesture = { kind: "pan", id };
      return;
    }
    if (mouse && event.button !== 0) return;
    const tool = props.tool;
    if (tool === "orbit") {
      gesture = { kind: event.shiftKey ? "pan" : "orbit", id };
      return;
    }
    if (tool === "brush" || tool === "erase" || tool === "triangle") {
      const found = pick(event.clientX, event.clientY);
      if (!found) {
        gesture = { kind: "orbit", id };
        return;
      }
      gesture = { kind: "paint", id };
      lastPaint = null;
      doc.beginStep();
      paintAt(found, event.shiftKey);
      if (tool !== "triangle") showRing(found.world, found.hit.triangle);
      ctx.invalidate();
      return;
    }
    gesture = { kind: "click", id, x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent) {
    if (!doc || !props) return;
    const previous = pointers.get(event.pointerId);
    if (previous)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) {
      if (event.pointerType === "mouse") {
        hover = { x: event.clientX, y: event.clientY };
        updateHover(event.clientX, event.clientY);
      }
      return;
    }
    if (gesture.kind === "pinch") {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      if (spread > 0 && gesture.distance > 0) zoomBy(gesture.distance / spread);
      // Deux doigts qui glissent ensemble : tourner (souris : clic droit).
      orbitBy(mid[0] - gesture.mid[0], mid[1] - gesture.mid[1]);
      gesture.distance = spread;
      gesture.mid = mid;
      ctx.invalidate();
      return;
    }
    if (!previous || event.pointerId !== gesture.id) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (gesture.kind === "click") {
      if (
        Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >
        CLICK_SLOP_PX
      )
        gesture = { kind: "orbit", id: gesture.id };
      return;
    }
    if (gesture.kind === "orbit") orbitBy(dx, dy);
    else if (gesture.kind === "pan") panBy(dx, dy);
    else if (gesture.kind === "paint") {
      const found = pick(event.clientX, event.clientY);
      if (found) {
        paintAt(found, event.shiftKey);
        if (props.tool !== "triangle")
          showRing(found.world, found.hit.triangle);
      } else {
        lastPaint = null;
        hideCursors();
      }
    }
    ctx.invalidate();
  }

  function onPointerUp(event: PointerEvent) {
    try {
      view?.element.releasePointerCapture(event.pointerId);
    } catch {
      // Capture déjà perdue.
    }
    const had = pointers.delete(event.pointerId);
    if (!had || !gesture) return;
    if (gesture.kind === "pinch") {
      if (pointers.size === 0) gesture = null;
      return;
    }
    if (gesture.id !== event.pointerId) return;
    const done = gesture;
    gesture = null;
    lastPaint = null;
    if (done.kind === "paint" && doc?.endStep()) props?.onEdit?.();
    if (done.kind === "click" && event.type === "pointerup")
      clickTool(event.clientX, event.clientY);
    if (event.pointerType === "mouse")
      updateHover(event.clientX, event.clientY);
    ctx.invalidate();
  }

  function onPointerLeave() {
    hover = null;
    if (gesture) return;
    hideCursors();
    dropPreview();
    props?.onHover?.(null);
    ctx.invalidate();
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomBy(Math.exp(delta * 0.0012), event.clientX, event.clientY);
    if (hover) updateHover(hover.x, hover.y);
    ctx.invalidate();
  }

  function preventDefault(event: Event) {
    event.preventDefault();
  }

  return {
    mount(_ctx, descriptor) {
      view = descriptor;
      props = descriptor.props;
      applyTheme(ctx.theme);
      setPalette(props.palette);
      adopt(props.doc);
      lastNonce = props.viewCommand?.nonce ?? -1;
      const element = descriptor.element;
      const listen = <K extends keyof HTMLElementEventMap>(
        type: K,
        handler: (event: HTMLElementEventMap[K]) => void,
        options?: AddEventListenerOptions,
      ) => {
        element.addEventListener(type, handler as EventListener, options);
        disposers.push(() =>
          element.removeEventListener(type, handler as EventListener),
        );
      };
      listen("pointerdown", onPointerDown);
      listen("pointermove", onPointerMove);
      listen("pointerup", onPointerUp);
      listen("pointercancel", onPointerUp);
      listen("pointerleave", onPointerLeave);
      listen("wheel", onWheel, { passive: false });
      listen("contextmenu", preventDefault);
      listen("dragstart", preventDefault);
    },
    update(next) {
      const previous = props;
      props = next;
      if (next.doc !== doc) {
        setPalette(next.palette);
        adopt(next.doc);
      } else if (setPalette(next.palette)) recolorAll();
      if (previous && previous.plate !== next.plate) syncVolume();
      if (next.viewCommand && next.viewCommand.nonce !== lastNonce) {
        lastNonce = next.viewCommand.nonce;
        frame(next.viewCommand.preset, true);
      }
      if (
        previous &&
        (previous.tool !== next.tool ||
          previous.slot !== next.slot ||
          previous.fillMode !== next.fillMode ||
          previous.fillAngle !== next.fillAngle ||
          previous.clipZ !== next.clipZ ||
          previous.version !== next.version)
      ) {
        dropPreview();
        if (next.tool !== "measure" && measure) {
          measure = null;
          syncMeasure();
          next.onMeasure?.(null);
        }
        if (hover && !gesture) updateHover(hover.x, hover.y);
        else hideCursors();
      }
      ctx.invalidate();
    },
    render(current: StageContext, frameInfo: ViewFrame) {
      if (!doc || !props) return false;
      if (current.theme !== theme) applyTheme(current.theme);
      syncTransform();
      syncChanges();
      if (overlayDirty) rebuildOverlay();
      let again = gesture !== null && gesture.kind !== "click";
      if (animation) {
        const k = Math.min(
          1,
          (performance.now() - animation.start) / 1000 / VIEW_ANIMATION_S,
        );
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        target.lerpVectors(animation.from[0], animation.to[0], e);
        distance =
          animation.from[1] + (animation.to[1] - animation.from[1]) * e;
        azimuth = animation.from[2] + (animation.to[2] - animation.from[2]) * e;
        elevation =
          animation.from[3] + (animation.to[3] - animation.from[3]) * e;
        if (k >= 1) animation = null;
        else again = true;
      }
      const rect = frameInfo.rect;
      placeCamera(rect.width / Math.max(1, rect.height));
      if (measure) syncMeasure();
      const clipZ = props.clipZ;
      material.clippingPlanes = clipZ === null ? null : clipPlanes;
      clipPlane.constant = clipZ ?? 0;
      const clipping = current.renderer.localClippingEnabled;
      current.renderer.localClippingEnabled = clipZ !== null;
      current.renderer.render(scene, camera);
      current.renderer.localClippingEnabled = clipping;
      if (!ready) {
        ready = true;
        props.onReady?.();
      }
      return again;
    },
    dispose() {
      for (const off of disposers.splice(0)) off();
      baseGeometry?.dispose();
      overlayGeometry?.dispose();
      plateTex?.dispose();
      material.dispose();
      plateMaterial.dispose();
      volumeMaterial.dispose();
      volume.geometry.dispose();
      plate.geometry.dispose();
      cursorMaterial.dispose();
      ringShadowMaterial.dispose();
      ringGeometry.dispose();
      heightMaterial.dispose();
      for (const plane of heightPlanes) plane.geometry.dispose();
      for (const dot of measurePoints) dot.geometry.dispose();
      measureMaterial.dispose();
      measureLine.geometry.dispose();
      scene.clear();
      doc = null;
    },
  };
};

export default create;
