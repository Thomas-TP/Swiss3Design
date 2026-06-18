import type * as THREE_NS from "three";

// Scène « showroom » partagée par le viewer interactif et la vignette de
// galerie (snapshot), pour qu'ils montrent EXACTEMENT le même rendu.
//
// Pièce de galerie épurée : murs gris clair bornés (fini l'artefact de « sol
// carré » d'une surface infinie), sol en parquet bois, grand socle clair sur
// tapis rouge marque, et un spot directionnel qui met l'objet en lumière.
// Tout est procédural et fixe (identique en thème clair/sombre) → universel
// (un modèle clair comme foncé ressort) et sans aucun asset externe à valider.

const BRAND_RED = "#E5231C";

export interface ShowroomScene {
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  target: THREE_NS.Vector3;
  maxDim: number;
  tintMaterials: THREE_NS.MeshStandardMaterial[];
  dispose: () => void;
}

// Texture de parquet peinte au canvas : lames bois ton medium (entre clair et
// foncé), veinage et joints. Tuilée sur le sol via RepeatWrapping.
function paintParquet(THREE: typeof THREE_NS): THREE_NS.Texture {
  const w = 512;
  const h = 512;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const planks = 5;
  const pw = w / planks;
  // Joints sombres en fond.
  ctx.fillStyle = "#5b3f24";
  ctx.fillRect(0, 0, w, h);
  const tones = ["#a9794a", "#9d6e40", "#b08152", "#946537", "#a47346"];
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(x + 1.5, 0, pw - 3, h);
    // Veinage : fines stries verticales légèrement ondulées.
    for (let s = 0; s < 16; s++) {
      ctx.strokeStyle = `rgba(40,24,10,${0.04 + Math.random() * 0.06})`;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      const gx = x + 3 + Math.random() * (pw - 6);
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= h; y += 28) {
        ctx.lineTo(gx + Math.sin(y * 0.05 + i) * 2, y);
      }
      ctx.stroke();
    }
    // Joint d'about (décalé par lame) pour casser l'alignement.
    const jointY = (i * 173) % h;
    ctx.strokeStyle = "#5b3f24";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 1.5, jointY);
    ctx.lineTo(x + pw - 1.5, jointY);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
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
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#5f6364");

  // Éclairage image-based réaliste (réflexions douces) sans HDR externe.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 4000);

  const tintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.05,
    roughness: 0.5,
  });

  // Chargement du modèle.
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
  // Socle plus grand et plus haut.
  const podiumRadius = footprintR * 1.7 + maxDim * 0.3;
  const podiumHeight = maxDim * 0.6;
  const floorY = -podiumHeight;

  // ---- Pièce fermée (sol + 4 murs + plafond), gris clair, bornée.
  const roomW = maxDim * 14;
  const roomD = maxDim * 14;
  const roomH = maxDim * 8;
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(roomW, roomH, roomD),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#7F8385"),
      roughness: 0.95,
      metalness: 0,
      side: THREE.BackSide,
    }),
  );
  shell.position.y = floorY + roomH / 2;
  shell.receiveShadow = true;
  scene.add(shell);

  // ---- Sol parquet bois (peu brillant), reçoit l'ombre.
  const parquet = paintParquet(THREE);
  parquet.anisotropy = renderer.capabilities.getMaxAnisotropy();
  parquet.repeat.set(roomW / (maxDim * 4), roomD / (maxDim * 4));
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshStandardMaterial({
      map: parquet,
      roughness: 0.6,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY + 0.001;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- Tapis rouge marque, épais (cylindre posé sur le sol → pas de z-fight).
  const rugThickness = maxDim * 0.05;
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(podiumRadius * 2.3, podiumRadius * 2.3, rugThickness, 80),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(BRAND_RED),
      roughness: 0.92,
      metalness: 0,
    }),
  );
  rug.position.y = floorY + rugThickness / 2;
  rug.receiveShadow = true;
  scene.add(rug);

  // ---- Grand socle clair sur plinthe sombre, posé sur le tapis.
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(podiumRadius, podiumRadius * 1.03, podiumHeight, 96),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#cbc7c0"),
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  podium.position.y = -podiumHeight / 2 + rugThickness;
  podium.castShadow = true;
  podium.receiveShadow = true;
  scene.add(podium);
  const plinthHeight = podiumHeight * 0.18;
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(podiumRadius * 1.12, podiumRadius * 1.16, plinthHeight, 96),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#23201b"),
      roughness: 0.6,
      metalness: 0.1,
    }),
  );
  plinth.position.y = floorY + rugThickness + plinthHeight / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  scene.add(plinth);

  // ---- Éclairage galerie : ambiant bas + spot (clé/ombre) + contour + fills.
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const spot = new THREE.SpotLight(0xfff4e8, 4.2, 0, 0.6, 0.7, 0);
  spot.position.set(maxDim * 1.4, maxDim * 5, maxDim * 2.6);
  spot.target.position.set(0, size.y * 0.4, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.radius = 7;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = maxDim * 0.5;
  spot.shadow.camera.far = maxDim * 18;
  scene.add(spot.target, spot);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 1.2);
  rim.position.set(-maxDim * 2.6, maxDim * 2.4, -maxDim * 3.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(maxDim * 2, maxDim * 0.6, maxDim * 3);
  scene.add(fill);
  // Deux fills chauds près du plafond → ambiance de pièce.
  for (const px of [-1, 1]) {
    const lamp = new THREE.PointLight(0xffe8cf, 8, maxDim * 18, 2);
    lamp.position.set(px * roomW * 0.32, floorY + roomH * 0.92, roomD * 0.12);
    scene.add(lamp);
  }

  // ---- Cadrage : vue 3/4 légèrement plongeante, centrée sur l'objet.
  const target = new THREE.Vector3(0, size.y * 0.5, 0);
  const dist = maxDim * 3;
  camera.position.set(dist * 0.66, target.y + maxDim * 0.75, dist * 0.96);
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
    parquet.dispose();
  };

  return { scene, camera, target, maxDim, tintMaterials, dispose };
}
