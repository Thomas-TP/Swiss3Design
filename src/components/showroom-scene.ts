import type * as THREE_NS from "three";

// Scène « showroom » partagée par le viewer interactif et la vignette de
// galerie (snapshot), pour qu'ils montrent EXACTEMENT le même rendu.
//
// C'est une vraie pièce fermée et meublée (galerie/boutique) plutôt qu'un sol
// infini : murs + plafond bornés (fini l'artefact de « sol carré »), tableaux
// encadrés, console meublée avec objets déco, tapis sous le socle, et un spot
// directionnel qui met l'objet en lumière. Tons sombres et neutres → fixes
// (identiques en thème clair/sombre) et universels : un modèle blanc ressort sur
// les murs sombres, un modèle foncé ressort grâce au spot + lumière de contour.
// Entièrement procédural : aucun asset externe à valider.

export interface ShowroomScene {
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  target: THREE_NS.Vector3;
  maxDim: number;
  tintMaterials: THREE_NS.MeshStandardMaterial[];
  dispose: () => void;
}

// Petite texture peinte au canvas (dégradé + accents) pour habiller un tableau.
function paintArtwork(
  THREE: typeof THREE_NS,
  variant: number,
): THREE_NS.Texture {
  const w = 256;
  const h = 320;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  // Fond toilé clair (les tableaux apportent des touches claires dans la pièce).
  const palettes = [
    ["#efece6", "#d8cfc1", "#b9ac98"],
    ["#e7e9ee", "#c7ccd6", "#9aa2b1"],
    ["#f0e7e6", "#dcc7c4", "#c0a09c"],
  ];
  const p = palettes[variant % palettes.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p[0]);
  g.addColorStop(0.6, p[1]);
  g.addColorStop(1, p[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Quelques formes abstraites sobres.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = p[2];
  ctx.beginPath();
  ctx.arc(w * 0.66, h * 0.34, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = p[0];
  ctx.fillRect(w * 0.12, h * 0.55, w * 0.5, h * 0.06);
  ctx.fillRect(w * 0.12, h * 0.68, w * 0.34, h * 0.045);
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function buildShowroomScene(
  renderer: THREE_NS.WebGLRenderer,
  modelUrl: string,
  colorHex: string,
  aspect: number,
): Promise<ShowroomScene> {
  const THREE = await import("three");
  const { RoomEnvironment } = await import(
    "three/addons/environments/RoomEnvironment.js"
  );

  // Configuration de rendu (identique partout : viewer & snapshot).
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a1713");

  // Éclairage image-based réaliste (réflexions douces) sans HDR externe.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 4000);

  const tintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.05,
    roughness: 0.5,
  });

  // Chargement du modèle (mêmes loaders que l'ancien viewer).
  let object: THREE_NS.Object3D;
  const tintMaterials: THREE_NS.MeshStandardMaterial[] = [];
  const ext = modelUrl.split(".").pop()?.toLowerCase();
  if (ext === "stl") {
    const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
    const geometry = await new STLLoader().loadAsync(modelUrl);
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, tintMaterial);
    tintMaterials.push(tintMaterial);
  } else {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    object = gltf.scene;
    object.traverse((child) => {
      const mesh = child as THREE_NS.Mesh;
      if (mesh.isMesh) {
        const m = tintMaterial.clone();
        mesh.material = m;
        tintMaterials.push(m);
      }
    });
    if (tintMaterials.length === 0) tintMaterials.push(tintMaterial);
  }
  object.traverse((child) => {
    const mesh = child as THREE_NS.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  // Centre l'objet et le pose, base à y = 0.
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.position.y += size.y / 2;
  scene.add(object);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const footprintR = Math.hypot(size.x, size.z) / 2 || maxDim / 2;
  const podiumRadius = footprintR * 1.45 + maxDim * 0.1;
  const podiumHeight = maxDim * 0.16;
  const floorY = -podiumHeight;

  // ---- Pièce fermée (sol + 4 murs + plafond), bornée → pas de « sol carré ».
  const roomW = maxDim * 13;
  const roomD = maxDim * 13;
  const roomH = maxDim * 7.5;
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(roomW, roomH, roomD),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#39342d"),
      roughness: 0.95,
      metalness: 0,
      side: THREE.BackSide,
    }),
  );
  shell.position.y = floorY + roomH / 2;
  shell.receiveShadow = true;
  scene.add(shell);

  // Sol mat (peu brillant) posé sur la face basse, reçoit l'ombre.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2a2620"),
      roughness: 0.7,
      metalness: 0.08,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY + 0.001;
  floor.receiveShadow = true;
  scene.add(floor);

  const backZ = -roomD / 2 + maxDim * 0.06;
  const wallTextures: THREE_NS.Texture[] = [];

  // ---- Tableaux encadrés sur le mur du fond (touches claires = déco).
  const makeArtwork = (artW: number, artH: number, variant: number) => {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(artW + maxDim * 0.06, artH + maxDim * 0.06, maxDim * 0.04),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0f0d0b"),
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    const tex = paintArtwork(THREE, variant);
    wallTextures.push(tex);
    const canvas = new THREE.Mesh(
      new THREE.PlaneGeometry(artW, artH),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }),
    );
    canvas.position.z = maxDim * 0.021;
    group.add(frame, canvas);
    return group;
  };
  const artH = maxDim * 1.7;
  const artW = maxDim * 1.25;
  const artY = floorY + roomH * 0.46;
  for (let i = -1; i <= 1; i++) {
    const art = makeArtwork(artW, artH, i + 1);
    art.position.set(i * maxDim * 2.4, artY, backZ);
    scene.add(art);
  }

  // ---- Console (meuble) contre le mur du fond + objets déco dessus.
  const consoleW = maxDim * 3.2;
  const consoleH = maxDim * 1.1;
  const consoleD = maxDim * 0.7;
  const consoleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1c1916"),
    roughness: 0.5,
    metalness: 0.15,
  });
  const consoleTop = new THREE.Mesh(
    new THREE.BoxGeometry(consoleW, maxDim * 0.08, consoleD),
    consoleMat,
  );
  const consoleZ = backZ + consoleD / 2 + maxDim * 0.05;
  consoleTop.position.set(maxDim * 2.4, floorY + consoleH, consoleZ);
  consoleTop.castShadow = true;
  consoleTop.receiveShadow = true;
  scene.add(consoleTop);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(maxDim * 0.08, consoleH, maxDim * 0.08),
      consoleMat,
    );
    leg.position.set(
      maxDim * 2.4 + sx * (consoleW / 2 - maxDim * 0.1),
      floorY + consoleH / 2,
      consoleZ,
    );
    leg.castShadow = true;
    scene.add(leg);
  }
  // Vase + sphère déco sur la console.
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(maxDim * 0.16, maxDim * 0.22, maxDim * 0.7, 32),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#b6ada0"),
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  vase.position.set(maxDim * 1.55, floorY + consoleH + maxDim * 0.39, consoleZ);
  vase.castShadow = true;
  scene.add(vase);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(maxDim * 0.2, 32, 32),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#8d8579"),
      roughness: 0.2,
      metalness: 0.3,
    }),
  );
  orb.position.set(maxDim * 3.1, floorY + consoleH + maxDim * 0.24, consoleZ);
  orb.castShadow = true;
  scene.add(orb);

  // ---- Tapis sous le socle : délimite la zone d'exposition.
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(podiumRadius * 3.2, 64),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#403a32"),
      roughness: 0.95,
      metalness: 0,
    }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = floorY + 0.002;
  rug.receiveShadow = true;
  scene.add(rug);

  // ---- Socle clair sur plinthe sombre (se lit sur le stage sombre).
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(podiumRadius, podiumRadius * 1.04, podiumHeight, 96),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#cbc7c0"),
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  podium.position.y = -podiumHeight / 2;
  podium.castShadow = true;
  podium.receiveShadow = true;
  scene.add(podium);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(podiumRadius * 1.18, podiumRadius * 1.22, podiumHeight * 0.4, 96),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#23201b"),
      roughness: 0.6,
      metalness: 0.1,
    }),
  );
  plinth.position.y = floorY + podiumHeight * 0.2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  scene.add(plinth);

  // ---- Éclairage galerie : ambiant bas + spot (clé/ombre) + contour + fills.
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const spot = new THREE.SpotLight(0xfff4e8, 4.4, 0, 0.6, 0.7, 0);
  spot.position.set(maxDim * 1.4, maxDim * 5, maxDim * 2.6);
  spot.target.position.set(0, size.y * 0.4, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.radius = 7;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = maxDim * 0.5;
  spot.shadow.camera.far = maxDim * 16;
  scene.add(spot.target, spot);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 1.3);
  rim.position.set(-maxDim * 2.6, maxDim * 2.4, -maxDim * 3.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(maxDim * 2, maxDim * 0.6, maxDim * 3);
  scene.add(fill);
  // Deux fills chauds près du plafond → ambiance de pièce.
  for (const px of [-1, 1]) {
    const lamp = new THREE.PointLight(0xffe8cf, 12, maxDim * 16, 2);
    lamp.position.set(px * roomW * 0.32, floorY + roomH * 0.9, roomD * 0.1);
    scene.add(lamp);
  }

  // ---- Cadrage : vue 3/4 légèrement plongeante, centrée sur l'objet.
  const target = new THREE.Vector3(0, size.y * 0.5, 0);
  const dist = maxDim * 2.8;
  camera.position.set(dist * 0.66, target.y + maxDim * 0.8, dist * 0.96);
  camera.near = maxDim / 100;
  camera.far = maxDim * 200;
  camera.lookAt(target);
  camera.updateProjectionMatrix();

  const dispose = () => {
    scene.traverse((o) => {
      const mesh = o as THREE_NS.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as
        | THREE_NS.Material
        | THREE_NS.Material[]
        | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    envTexture.dispose();
    for (const t of wallTextures) t.dispose();
  };

  return { scene, camera, target, maxDim, tintMaterials, dispose };
}
