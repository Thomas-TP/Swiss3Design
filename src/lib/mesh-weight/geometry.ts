// Volume et surface d'un maillage triangulé (pur, sans DOM) : la base de
// l'estimation du poids d'un fichier 3D dans le navigateur.

export interface MeshStats {
  /** Volume en mm³ (valeur absolue : une normale inversée ne change rien). */
  volumeMm3: number;
  /** Surface en mm². */
  areaMm2: number;
  /** [minX, minY, minZ, maxX, maxY, maxZ] en mm. */
  bbox: [number, number, number, number, number, number];
  triangles: number;
}

/** Somme des volumes signés (tétraèdres depuis l'origine) et des aires des triangles. */
export class MeshAccumulator {
  private volume = 0;
  private area = 0;
  private count = 0;
  private readonly box: [number, number, number, number, number, number] = [
    Infinity,
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
    -Infinity,
  ];

  /** Un triangle (sommets a, b, c, en mm). */
  triangle(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
  ) {
    this.volume +=
      (ax * (by * cz - bz * cy) -
        ay * (bx * cz - bz * cx) +
        az * (bx * cy - by * cx)) /
      6;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    this.area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
    this.count++;
    const box = this.box;
    for (const [x, y, z] of [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ] as const) {
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (z < box[2]) box[2] = z;
      if (x > box[3]) box[3] = x;
      if (y > box[4]) box[4] = y;
      if (z > box[5]) box[5] = z;
    }
  }

  get triangles() {
    return this.count;
  }

  stats(): MeshStats {
    return {
      volumeMm3: Math.abs(this.volume),
      areaMm2: this.area,
      bbox: [...this.box],
      triangles: this.count,
    };
  }
}
