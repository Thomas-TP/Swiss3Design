// Maillages de test de l'atelier 3D (tests seulement).

/** Cube de `size` mm, 12 triangles (normales vers l'extérieur), coin en (0,0,0). */
export function cubePositions(size = 10): Float32Array {
  const s = size;
  const v = [
    [0, 0, 0],
    [s, 0, 0],
    [s, s, 0],
    [0, s, 0],
    [0, 0, s],
    [s, 0, s],
    [s, s, s],
    [0, s, s],
  ];
  const faces = [
    [0, 2, 1, 0, 3, 2], // dessous
    [4, 5, 6, 4, 6, 7], // dessus
    [0, 1, 5, 0, 5, 4], // devant
    [2, 3, 7, 2, 7, 6], // derrière
    [1, 2, 6, 1, 6, 5], // droite
    [3, 0, 4, 3, 4, 7], // gauche
  ];
  const out: number[] = [];
  for (const face of faces) for (const i of face) out.push(...v[i]);
  return Float32Array.from(out);
}

/** Grille plate n × n carrés (2 triangles chacun) de `step` mm, dans le plan z = 0. */
export function gridPositions(n: number, step = 1): Float32Array {
  const out: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = i * step;
      const y = j * step;
      out.push(x, y, 0, x + step, y, 0, x + step, y + step, 0);
      out.push(x, y, 0, x + step, y + step, 0, x, y + step, 0);
    }
  return Float32Array.from(out);
}
