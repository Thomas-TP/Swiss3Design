// Web Worker (classique) : lit un fichier STEP/STP avec occt-import-js (OpenCascade
// compilé en WebAssembly, LGPL-2.1, voir LICENSE.md) et renvoie le volume, la
// surface et la boîte englobante du maillage triangulé, en millimètres, plus, si
// on les demande (`mesh: true`), ses triangles (positions, trois sommets par
// triangle) pour l'aperçu 3D de « Sur mesure ».
// Servi tel quel depuis public/ : jamais dans le Worker Cloudflare (règle d'or 10).
// Ses réponses ne portent aucune en-tête CSP (chemin avec un point, hors du
// middleware) : le WebAssembly d'un Worker du Web n'exige pas 'wasm-unsafe-eval'
// côté page. Le client le termine après 20 s (src/lib/mesh-weight/client.ts).
/* global importScripts, occtimportjs */
importScripts("/vendor/occt/occt-import-js.js");

let occtPromise = null;

self.onmessage = async (event) => {
  const { id, buffer, mesh: withMesh } = event.data;
  try {
    occtPromise =
      occtPromise ||
      occtimportjs({ locateFile: (path) => "/vendor/occt/" + path });
    const occt = await occtPromise;
    const result = occt.ReadStepFile(new Uint8Array(buffer), {
      linearUnit: "millimeter",
    });
    if (!result || !result.success || !result.meshes || !result.meshes.length) {
      self.postMessage({ id, ok: false, reason: "unreadable" });
      return;
    }
    let volume = 0;
    let area = 0;
    let triangles = 0;
    let indexCount = 0;
    for (const mesh of result.meshes) indexCount += mesh.index.array.length;
    const positions = withMesh ? new Float32Array(indexCount * 3) : null;
    let written = 0;
    const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const mesh of result.meshes) {
      const p = mesh.attributes.position.array;
      const index = mesh.index.array;
      let meshVolume = 0;
      for (let t = 0; t < index.length; t += 3) {
        const a = index[t] * 3;
        const b = index[t + 1] * 3;
        const c = index[t + 2] * 3;
        const ax = p[a], ay = p[a + 1], az = p[a + 2];
        const bx = p[b], by = p[b + 1], bz = p[b + 2];
        const cx = p[c], cy = p[c + 1], cz = p[c + 2];
        if (positions) {
          positions.set([ax, ay, az, bx, by, bz, cx, cy, cz], written);
          written += 9;
        }
        meshVolume +=
          (ax * (by * cz - bz * cy) -
            ay * (bx * cz - bz * cx) +
            az * (bx * cy - by * cx)) /
          6;
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
        triangles++;
      }
      for (let v = 0; v < p.length; v += 3) {
        for (let k = 0; k < 3; k++) {
          if (p[v + k] < bbox[k]) bbox[k] = p[v + k];
          if (p[v + k] > bbox[k + 3]) bbox[k + 3] = p[v + k];
        }
      }
      // Chaque maillage est un solide (ou une coque) : son volume compte en valeur absolue.
      volume += Math.abs(meshVolume);
    }
    const answer = {
      id,
      ok: true,
      volumeMm3: volume,
      areaMm2: area,
      bbox,
      triangles,
    };
    if (positions) {
      answer.positions = positions;
      self.postMessage(answer, [positions.buffer]);
    } else self.postMessage(answer);
  } catch {
    self.postMessage({ id, ok: false, reason: "unreadable" });
  }
};
