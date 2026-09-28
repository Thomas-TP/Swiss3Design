// Scène témoin de WP-00 (brief « Strates », §4.4) : un cube papier, en
// attendant que chaque package remplace le stub de sa scène (print-hero et
// contour-field : WP-HOME ; studio-object : WP-STUDIO ; product-viewer :
// WP-SHOP). Elle exerce tout le cœur du Stage : environnement partagé,
// lumière du nord-ouest, caméra longue focale (fov 20°, élévation 22°,
// azimut −28°, §2.4 et §5.3), matériau d'impression (coupe qui monte, bandes,
// fantômes, liseré chaud), thème, contrôleur et rendu à la demande.
//
// En production, le stub garde le poster SSR (holdPoster) : l'accueil
// fonctionne avec ses posters tant que la vraie scène n'est pas fusionnée.
// En développement, il remplace le poster pour qu'on puisse valider scissor,
// bake et thème. Supprimé par WP-99 quand plus aucun stub ne l'importe.
import {
  BoxGeometry,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import {
  createPrintMaterial,
  type PrintMaterial,
} from "../materials/print-material";
import type { StageContext, StageScene, StageTheme } from "../types";

export interface StubController {
  /** Vitesse de rotation (tours par 10 s) ; animable par GSAP. */
  spin: number;
}

const SIZE_MM = 60;
// Un poil sous 60 mm : le couvercle ne tombe pas pile sur un anneau fantôme
// (tous les 2 mm), qui le peindrait en entier.
const HEIGHT_MM = 59;
const PRINT_SECONDS = 4.2;
const FOV = 20;
const ELEVATION = (22 * Math.PI) / 180;
const AZIMUTH = (-28 * Math.PI) / 180;
// Palette « Léman », du bas vers le haut (§2.1), teintes indicatives.
const LEMAN = [
  { topMm: 20, color: "#2e6a9e" },
  { topMm: 40, color: "#5e7f3a" },
  { topMm: HEIGHT_MM, color: "#f5f5f4" },
];

export function createStubScene<P>(
  ctx: StageContext,
  { print }: { print: boolean },
): StageScene<P, StubController> {
  const scene = new Scene();
  scene.environment = ctx.envMap;
  scene.environmentIntensity = 0.6;
  // Lumière du nord-ouest (convention d'estompage suisse : en haut à gauche).
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 1.4, 0.8).normalize().multiplyScalar(400);
  scene.add(sun);

  const pivot = new Group();
  scene.add(pivot);
  // Z vers le haut du générateur → Y vers le haut de three : −90° autour de X.
  const geometry = new BoxGeometry(SIZE_MM, SIZE_MM, HEIGHT_MM).translate(
    0,
    0,
    HEIGHT_MM / 2,
  );
  let printMaterial: PrintMaterial | null = null;
  let plainMaterial: MeshStandardMaterial | null = null;
  let edges: LineSegments<EdgesGeometry, LineBasicMaterial> | null = null;
  const object = new Group();
  object.rotation.x = -Math.PI / 2;
  pivot.add(object);
  if (print) {
    printMaterial = createPrintMaterial({ heightMm: HEIGHT_MM, bands: LEMAN });
    printMaterial.uniforms.uGhost.value = 1;
    object.add(new Mesh(geometry, printMaterial.material));
  } else {
    plainMaterial = new MeshStandardMaterial({ roughness: 0.62 });
    object.add(new Mesh(geometry, plainMaterial));
    edges = new LineSegments(
      new EdgesGeometry(geometry),
      new LineBasicMaterial({ toneMapped: false }),
    );
    object.add(edges);
  }

  const camera = new PerspectiveCamera(FOV, 1, 10, 5000);
  const target = new Vector3(0, HEIGHT_MM / 2, 0);
  // Sphère englobante du cube dans 78 % de la hauteur de la vue.
  const radius = (SIZE_MM * Math.sqrt(3)) / 2;
  const distance = radius / 0.78 / Math.sin(((FOV / 2) * Math.PI) / 180);
  camera.position.set(
    target.x + distance * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    target.y + distance * Math.sin(ELEVATION),
    target.z + distance * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  camera.lookAt(target);

  let theme: StageTheme | null = null;
  let startedAt = -1;
  let spin = 1;
  const controller: StubController = {
    get spin() {
      return spin;
    },
    set spin(value) {
      spin = value;
      ctx.invalidate();
    },
  };

  function applyTheme(next: StageTheme) {
    theme = next;
    printMaterial?.setTheme(next);
    plainMaterial?.color.set(next.paper);
    edges?.material.color.set(next.ink);
  }

  return {
    controller,
    holdPoster: process.env.NODE_ENV === "production",
    mount() {
      applyTheme(ctx.theme);
    },
    update() {
      // Un stub n'a pas de props : on redessine simplement.
      ctx.invalidate();
    },
    render(current, frame) {
      if (current.theme !== theme) applyTheme(current.theme);
      const animate = !current.reduced;
      if (startedAt < 0) startedAt = frame.time;
      const elapsed = frame.time - startedAt;
      if (printMaterial) {
        // Impression en boucle (4,2 s, comme l'autoplay mobile), figée en
        // mouvement réduit sur l'objet entier.
        const progress = animate
          ? (elapsed % (PRINT_SECONDS + 1)) / PRINT_SECONDS
          : 1;
        printMaterial.setCut(Math.min(1, progress) * HEIGHT_MM);
        printMaterial.uniforms.uHot.value = progress < 1 ? 1 : 0;
      }
      pivot.rotation.y = animate ? elapsed * spin * ((2 * Math.PI) / 10) : 0;
      camera.aspect = frame.rect.width / Math.max(1, frame.rect.height);
      camera.updateProjectionMatrix();
      current.renderer.render(scene, camera);
      return animate && (spin !== 0 || printMaterial !== null);
    },
    dispose() {
      geometry.dispose();
      printMaterial?.dispose();
      plainMaterial?.dispose();
      edges?.geometry.dispose();
      edges?.material.dispose();
    },
  };
}
