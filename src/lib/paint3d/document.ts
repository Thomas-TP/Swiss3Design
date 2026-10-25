// Document de l'atelier 3D : le maillage du visiteur (triangles d'origine,
// dans le repère et l'unité de son fichier, en mm), la peinture de chaque
// triangle (selector.ts), la taille et l'orientation choisies, et l'historique
// (annuler, rétablir). Pur TypeScript : l'interface (src/components/paint) le
// possède, la scène du Stage (src/motion/stage/scenes/paint-editor.ts) le
// dessine et l'interroge (BVH), l'export (write3mf.ts) l'écrit.
//
// États : 0 = non peint (la couleur de base, emplacement 1), n ≥ 1 = la couleur
// de l'emplacement n (n = 1 : la base, peinte explicitement). À l'export,
// l'état n devient le filament n, et 0 le filament par défaut de l'objet (1) :
// exactement la convention des trancheurs.
//
// La palette (couleur du stock de chaque emplacement, et teinte d'origine du
// fichier) fait partie du document et de son historique (25.10.2026) : ajouter,
// changer ou retirer une couleur s'annule comme un coup de pinceau, et une
// couleur retirée retrouve ses zones à l'annulation, comme dans les trancheurs.
import { buildBvh, type Bvh } from "./bvh";
import {
  cloneNode,
  collapse,
  isSplit,
  remapNode,
  type PaintNode,
  type PaintSplit,
} from "./selector";
import { buildTopology, creasedNormals, type Topology } from "./topology";

/** Matrice 3 × 3 (lignes) : rotation de l'objet sur le plateau. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const IDENTITY3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiply3(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out.push(
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c],
      );
  return out as unknown as Mat3;
}

/** Rotation d'un quart de tour (signe +1/−1) autour d'un axe du plateau. */
export function quarterTurn(axis: "x" | "y" | "z", sign: 1 | -1): Mat3 {
  const s = sign;
  if (axis === "x") return [1, 0, 0, 0, 0, -s, 0, s, 0];
  if (axis === "y") return [0, 0, s, 0, 1, 0, -s, 0, 0];
  return [0, -s, 0, s, 0, 0, 0, 0, 1];
}

/** Rotation qui amène la direction unitaire `from` sur `to` (Rodrigues). */
export function rotationBetween(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): Mat3 {
  const [ax, ay, az] = from;
  const [bx, by, bz] = to;
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  const cos = ax * bx + ay * by + az * bz;
  if (cos > 1 - 1e-9) return IDENTITY3;
  if (cos < -1 + 1e-9) {
    // Demi-tour autour d'un axe perpendiculaire à `from`.
    const px = Math.abs(ax) < 0.9 ? 1 : 0;
    const py = px ? 0 : 1;
    // from × (px, py, 0)
    let ux = -az * py;
    let uy = az * px;
    let uz = ax * py - ay * px;
    const l = Math.hypot(ux, uy, uz);
    ux /= l;
    uy /= l;
    uz /= l;
    return [
      2 * ux * ux - 1,
      2 * ux * uy,
      2 * ux * uz,
      2 * uy * ux,
      2 * uy * uy - 1,
      2 * uy * uz,
      2 * uz * ux,
      2 * uz * uy,
      2 * uz * uz - 1,
    ];
  }
  const k = 1 / (1 + cos);
  return [
    cos + cx * cx * k,
    cx * cy * k - cz,
    cx * cz * k + cy,
    cy * cx * k + cz,
    cos + cy * cy * k,
    cy * cz * k - cx,
    cz * cx * k - cy,
    cz * cy * k + cx,
    cos + cz * cz * k,
  ];
}

/** Arrondit les termes presque entiers (quarts de tour répétés : pas de dérive). */
export function snapRotation(m: Mat3): Mat3 {
  return m.map((v) => {
    const r = Math.round(v);
    return Math.abs(v - r) < 1e-9 ? r : v;
  }) as unknown as Mat3;
}

export interface PaintPart {
  name: string;
  /** Premier triangle de la pièce et nombre de triangles (plages contiguës). */
  first: number;
  count: number;
}

/** Couleur d'un emplacement (filament) : référence du stock et teinte du fichier. */
export interface PaletteEntry {
  /** Couleur du stock choisie (identifiant de référence). */
  ref: string;
  /** Teinte du filament dans le fichier d'origine (« #RRGGBB »), ou null. */
  origin: string | null;
}

export interface PaintSourceMesh {
  /** 9 nombres par triangle, en mm, dans le repère du fichier. */
  positions: Float32Array;
  parts?: PaintPart[];
  /** Peinture initiale (fichier déjà peint), en états du document. */
  paint?: ReadonlyMap<number, PaintNode>;
  /** Palette initiale (emplacement 1 en tête). */
  palette?: readonly PaletteEntry[];
}

interface Transform {
  rotation: Mat3;
  scale: number;
}

interface Step {
  triangles: number[];
  before: PaintNode[];
  after: PaintNode[];
  transformBefore?: Transform;
  transformAfter?: Transform;
  paletteBefore?: readonly PaletteEntry[];
  paletteAfter?: readonly PaletteEntry[];
}

const samePalette = (a: readonly PaletteEntry[], b: readonly PaletteEntry[]) =>
  a.length === b.length &&
  a.every((entry, i) => entry.ref === b[i].ref && entry.origin === b[i].origin);

export interface WorldBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

/** Limite de l'historique (pas d'annulation au-delà). */
const HISTORY_LIMIT = 80;

export class PaintDocument {
  readonly positions: Float32Array;
  readonly triangleCount: number;
  readonly parts: readonly PaintPart[];
  readonly topology: Topology;
  readonly bvh: Bvh;
  /** Normales par coin (adoucies, arêtes vives gardées), repère du fichier. */
  readonly cornerNormals: Float32Array;
  /** Sommets soudés (3 nombres chacun), pour les bornes. */
  private readonly vertices: Float32Array;

  private readonly states: Uint8Array;
  private readonly splits = new Map<number, PaintSplit>();

  rotation: Mat3 = IDENTITY3;
  scale = 1;
  /** Couleur de chaque emplacement (filament), dans l'ordre. */
  palette: readonly PaletteEntry[] = [];
  /** Décalage du repère du fichier vers le plateau (centré, posé à z = 0). */
  private offset: [number, number, number] = [0, 0, 0];
  private bounds: WorldBounds;

  /** Change à chaque modification (peinture, taille, orientation). */
  version = 0;
  paintVersion = 0;
  transformVersion = 0;

  private readonly changeMark: Uint8Array;
  private changeList: number[] = [];
  private undoStack: Step[] = [];
  private redoStack: Step[] = [];
  private current: Map<number, PaintNode> | null = null;
  private currentTransform: Transform | null = null;
  private currentPalette: readonly PaletteEntry[] | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(source: PaintSourceMesh) {
    this.positions = source.positions;
    this.triangleCount = Math.floor(source.positions.length / 9);
    this.parts = source.parts?.length
      ? source.parts
      : [{ name: "", first: 0, count: this.triangleCount }];
    this.topology = buildTopology(this.positions);
    this.bvh = buildBvh(this.positions);
    this.cornerNormals = creasedNormals(this.topology);
    const { vertexOf, vertexCount } = this.topology;
    this.vertices = new Float32Array(vertexCount * 3);
    for (let c = 0; c < vertexOf.length; c++) {
      const v = vertexOf[c] * 3;
      this.vertices[v] = this.positions[c * 3];
      this.vertices[v + 1] = this.positions[c * 3 + 1];
      this.vertices[v + 2] = this.positions[c * 3 + 2];
    }
    this.states = new Uint8Array(this.triangleCount);
    this.changeMark = new Uint8Array(this.triangleCount);
    this.palette = source.palette ? [...source.palette] : [];
    if (source.paint)
      for (const [t, node] of source.paint) {
        if (t < 0 || t >= this.triangleCount) continue;
        const next = collapse(node);
        if (isSplit(next)) this.splits.set(t, next);
        else this.states[t] = next;
      }
    this.bounds = this.computePlacement();
  }

  // ── Peinture ──────────────────────────────────────────────────────────────

  node(t: number): PaintNode {
    return this.splits.get(t) ?? this.states[t];
  }

  isSplit(t: number): boolean {
    return this.splits.has(t);
  }

  /** Triangles coupés (feuilles plus fines que le maillage). */
  splitTriangles(): IterableIterator<number> {
    return this.splits.keys();
  }

  get splitCount(): number {
    return this.splits.size;
  }

  /** Remplace l'arbre d'un triangle (dans une étape ouverte par beginStep). */
  setNode(t: number, node: PaintNode): boolean {
    const next = collapse(node);
    const previous = this.node(t);
    if (!isSplit(next) && !isSplit(previous) && next === previous) return false;
    if (this.current && !this.current.has(t))
      this.current.set(t, cloneNode(previous));
    this.write(t, next);
    return true;
  }

  private write(t: number, node: PaintNode) {
    if (isSplit(node)) {
      this.splits.set(t, node);
      this.states[t] = 0;
    } else {
      this.splits.delete(t);
      this.states[t] = node;
    }
    if (!this.changeMark[t]) {
      this.changeMark[t] = 1;
      this.changeList.push(t);
    }
  }

  /** Donne (et oublie) les triangles modifiés depuis le dernier appel. */
  drainChanges(visit: (t: number) => void): number {
    const list = this.changeList;
    this.changeList = [];
    for (const t of list) {
      this.changeMark[t] = 0;
      visit(t);
    }
    return list.length;
  }

  // ── Étapes et historique ─────────────────────────────────────────────────

  /** Ouvre une étape (un trait de pinceau, un remplissage…), fermée par endStep. */
  beginStep() {
    if (this.current) this.endStep();
    this.current = new Map();
    this.currentTransform = { rotation: this.rotation, scale: this.scale };
    this.currentPalette = this.palette;
  }

  /** Ferme l'étape : elle entre dans l'historique si elle a changé quelque chose. */
  endStep(): boolean {
    const before = this.current;
    const transformBefore = this.currentTransform;
    const paletteBefore = this.currentPalette;
    this.current = null;
    this.currentTransform = null;
    this.currentPalette = null;
    if (!before) return false;
    const transformChanged =
      transformBefore !== null &&
      (transformBefore.scale !== this.scale ||
        transformBefore.rotation.some((v, i) => v !== this.rotation[i]));
    const paletteChanged =
      paletteBefore !== null && !samePalette(paletteBefore, this.palette);
    const triangles: number[] = [];
    const prior: PaintNode[] = [];
    const after: PaintNode[] = [];
    for (const [t, node] of before) {
      const now = this.node(t);
      if (!isSplit(now) && !isSplit(node) && now === node) continue;
      triangles.push(t);
      prior.push(node);
      after.push(cloneNode(now));
    }
    if (triangles.length === 0 && !transformChanged && !paletteChanged)
      return false;
    this.undoStack.push({
      triangles,
      before: prior,
      after,
      ...(transformChanged && transformBefore
        ? {
            transformBefore,
            transformAfter: { rotation: this.rotation, scale: this.scale },
          }
        : {}),
      ...(paletteChanged && paletteBefore
        ? { paletteBefore, paletteAfter: this.palette }
        : {}),
    });
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    if (triangles.length > 0) this.paintVersion++;
    this.bump();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    if (this.current) this.endStep();
    const step = this.undoStack.pop();
    if (!step) return false;
    this.apply(
      step.triangles,
      step.before,
      step.transformBefore,
      step.paletteBefore,
    );
    this.redoStack.push(step);
    return true;
  }

  redo(): boolean {
    const step = this.redoStack.pop();
    if (!step) return false;
    this.apply(
      step.triangles,
      step.after,
      step.transformAfter,
      step.paletteAfter,
    );
    this.undoStack.push(step);
    return true;
  }

  private apply(
    triangles: readonly number[],
    nodes: readonly PaintNode[],
    transform?: Transform,
    palette?: readonly PaletteEntry[],
  ) {
    for (let i = 0; i < triangles.length; i++)
      this.write(triangles[i], cloneNode(nodes[i]));
    if (triangles.length > 0) this.paintVersion++;
    if (transform) this.writeTransform(transform.rotation, transform.scale);
    if (palette) this.palette = palette;
    this.bump();
  }

  /** Efface toute la peinture (une étape, annulable). */
  clearPaint() {
    this.beginStep();
    // Copie : setNode retire les entrées de la table pendant le parcours.
    for (const t of Array.from(this.splits.keys())) this.setNode(t, 0);
    for (let t = 0; t < this.triangleCount; t++)
      if (this.states[t] !== 0) this.setNode(t, 0);
    this.endStep();
  }

  // ── Palette ──────────────────────────────────────────────────────────────

  /** Remplace la palette (dans une étape : annulable). */
  setPalette(next: readonly PaletteEntry[]) {
    if (samePalette(next, this.palette)) return;
    const own = !this.current;
    if (own) this.beginStep();
    this.palette = [...next];
    if (own) this.endStep();
  }

  /**
   * Retire l'emplacement `index` (≥ 1) : ses zones reprennent la couleur
   * principale, les suivants descendent d'un cran. Une seule étape : « Annuler »
   * rend la couleur ET ses zones.
   */
  removeSlot(index: number) {
    if (index < 1 || index >= this.palette.length) return;
    const own = !this.current;
    if (own) this.beginStep();
    const removed = index + 1;
    const map = Array.from({ length: 256 }, (_, s) =>
      s === removed ? 0 : s > removed ? s - 1 : s,
    );
    const touches = (node: PaintNode): boolean =>
      isSplit(node) ? node.c.some(touches) : node >= removed;
    for (const t of Array.from(this.splits.keys()))
      if (touches(this.splits.get(t)!))
        this.setNode(t, remapNode(this.node(t), map));
    for (let t = 0; t < this.triangleCount; t++)
      if (!this.splits.has(t) && this.states[t] >= removed)
        this.setNode(t, map[this.states[t]]);
    this.palette = this.palette.filter((_, i) => i !== index);
    if (own) this.endStep();
  }

  /** États présents (au moins une feuille), sans géométrie. */
  usedStates(): Set<number> {
    const used = new Set<number>();
    for (let t = 0; t < this.triangleCount; t++)
      if (!this.splits.has(t)) used.add(this.states[t]);
    const visit = (node: PaintNode) => {
      if (isSplit(node)) node.c.forEach(visit);
      else used.add(node);
    };
    for (const split of this.splits.values()) visit(split);
    return used;
  }

  // ── Taille et orientation ────────────────────────────────────────────────

  /** Change la taille et l'orientation (dans une étape : annulable). */
  setTransform(rotation: Mat3, scale: number) {
    const own = !this.current;
    if (own) this.beginStep();
    this.writeTransform(snapRotation(rotation), scale);
    if (own) this.endStep();
  }

  private writeTransform(rotation: Mat3, scale: number) {
    this.rotation = rotation;
    this.scale = scale;
    this.bounds = this.computePlacement();
    this.transformVersion++;
  }

  /** Taille, orientation : différentes de celles du fichier ? */
  get transformed(): boolean {
    return this.scale !== 1 || this.rotation.some((v, i) => v !== IDENTITY3[i]);
  }

  private computePlacement(): WorldBounds {
    const r = this.rotation;
    const s = this.scale;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    const v = this.vertices;
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i];
      const y = v[i + 1];
      const z = v[i + 2];
      const wx = s * (r[0] * x + r[1] * y + r[2] * z);
      const wy = s * (r[3] * x + r[4] * y + r[5] * z);
      const wz = s * (r[6] * x + r[7] * y + r[8] * z);
      if (wx < min[0]) min[0] = wx;
      if (wx > max[0]) max[0] = wx;
      if (wy < min[1]) min[1] = wy;
      if (wy > max[1]) max[1] = wy;
      if (wz < min[2]) min[2] = wz;
      if (wz > max[2]) max[2] = wz;
    }
    if (!Number.isFinite(min[0]))
      return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
    // Centré sur le plateau, posé dessus.
    this.offset = [-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]];
    const o = this.offset;
    const size: [number, number, number] = [
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2],
    ];
    return {
      min: [min[0] + o[0], min[1] + o[1], 0],
      max: [max[0] + o[0], max[1] + o[1], size[2]],
      size,
    };
  }

  /** Boîte de la pièce posée sur le plateau (mm, Z vers le haut, centrée en X, Y). */
  worldBounds(): WorldBounds {
    return this.bounds;
  }

  /**
   * Matrice 4 × 4 (colonnes, comme three.js) du repère du fichier vers le
   * plateau : rotation, taille, centrage.
   */
  worldMatrix(): number[] {
    const r = this.rotation;
    const s = this.scale;
    const o = this.offset;
    return [
      s * r[0],
      s * r[3],
      s * r[6],
      0,
      s * r[1],
      s * r[4],
      s * r[7],
      0,
      s * r[2],
      s * r[5],
      s * r[8],
      0,
      o[0],
      o[1],
      o[2],
      1,
    ];
  }

  /** Hauteur (mm, sur le plateau) d'un point du fichier. */
  worldZ(x: number, y: number, z: number): number {
    const r = this.rotation;
    return this.scale * (r[6] * x + r[7] * y + r[8] * z) + this.offset[2];
  }

  /** Point du fichier → plateau. */
  toWorld(x: number, y: number, z: number): [number, number, number] {
    const r = this.rotation;
    const s = this.scale;
    const o = this.offset;
    return [
      s * (r[0] * x + r[1] * y + r[2] * z) + o[0],
      s * (r[3] * x + r[4] * y + r[5] * z) + o[1],
      s * (r[6] * x + r[7] * y + r[8] * z) + o[2],
    ];
  }

  /** Point du plateau → fichier. */
  toModel(x: number, y: number, z: number): [number, number, number] {
    const r = this.rotation;
    const s = this.scale;
    const o = this.offset;
    const px = (x - o[0]) / s;
    const py = (y - o[1]) / s;
    const pz = (z - o[2]) / s;
    // Inverse d'une rotation : sa transposée.
    return [
      r[0] * px + r[3] * py + r[6] * pz,
      r[1] * px + r[4] * py + r[7] * pz,
      r[2] * px + r[5] * py + r[8] * pz,
    ];
  }

  /** Direction du plateau → fichier (sans le centrage ni la taille). */
  directionToModel(x: number, y: number, z: number): [number, number, number] {
    const r = this.rotation;
    return [
      r[0] * x + r[3] * y + r[6] * z,
      r[1] * x + r[4] * y + r[7] * z,
      r[2] * x + r[5] * y + r[8] * z,
    ];
  }

  /** Normale (fichier) d'un triangle tournée sur le plateau. */
  worldNormal(t: number): [number, number, number] {
    const n = this.topology.faceNormals;
    const r = this.rotation;
    const x = n[t * 3];
    const y = n[t * 3 + 1];
    const z = n[t * 3 + 2];
    return [
      r[0] * x + r[1] * y + r[2] * z,
      r[3] * x + r[4] * y + r[5] * z,
      r[6] * x + r[7] * y + r[8] * z,
    ];
  }

  // ── Abonnés (panneaux du DOM) ────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Signale un changement aux abonnés (fin d'étape, annuler, rétablir). */
  private bump() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  /** Les sommets d'un triangle d'origine (repère du fichier). */
  corners(t: number): Float32Array {
    return this.positions.subarray(t * 9, t * 9 + 9);
  }
}
