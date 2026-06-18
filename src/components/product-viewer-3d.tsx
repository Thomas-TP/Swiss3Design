"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Box, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useProductColor } from "./product-color-context";

// Viewer 3D **embarqué** dans la galerie produit (dernier "slot"). Three.js est
// chargé dynamiquement au montage (hors bundle initial) — la galerie ne monte ce
// composant que lorsque la vignette 3D est sélectionnée, donc le coût n'est payé
// qu'à la demande. La teinte du modèle suit la couleur choisie dans le bloc
// d'achat (contexte partagé) : un seul sélecteur de couleur sur la fiche.
//
// Mise en scène — « showroom » spotlighté **fixe** (identique clair/sombre, pas
// d'asset externe à valider) :
//  • Cyclorama : mur courbe sombre avec un wash lumineux peint au centre → un
//    fond SOMBRE derrière l'objet, ce qui fait enfin ressortir les modèles
//    blancs (le fond clair précédent les noyait).
//  • Spot directionnel + lumière de contour → les modèles foncés ressortent
//    aussi (faces éclairées + liseré sur fond sombre). Universel, toute couleur.
//  • Sol sombre brillant (réflexions d'environnement) + socle clair sur plinthe,
//    ombre de contact douce → ancrage réaliste, look galerie/musée.
//  • Éclairage image-based (RoomEnvironment) pour des réflexions réalistes.
export function ModelViewer({ modelUrl }: { modelUrl: string }) {
  const t = useTranslations("viewer");
  const { selected, colors } = useProductColor();
  const color = selected?.hex ?? colors[0]?.hex ?? "#E5231C";

  const mountRef = useRef<HTMLDivElement>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let onResize: (() => void) | undefined;
    let envTexture: THREE.Texture | undefined;
    let wallTexture: THREE.Texture | undefined;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/addons/controls/OrbitControls.js"
      );
      const { RoomEnvironment } = await import(
        "three/addons/environments/RoomEnvironment.js"
      );
      if (disposed) return;

      // Dégradé vertical du cyclorama, peint au canvas : sombre en haut et en
      // bas, avec une bande lumineuse "wash studio" au centre. Fixe (jamais lié
      // au thème). Avec flipY (défaut), le haut du canvas → sommet du cylindre.
      const makeWallTexture = (): THREE.Texture => {
        const w = 32;
        const h = 512;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d")!;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.0, "#17150f"); // sommet : sombre
        g.addColorStop(0.32, "#2f2b25");
        g.addColorStop(0.46, "#574f45"); // wash lumineux (derrière l'objet)
        g.addColorStop(0.6, "#2f2b25");
        g.addColorStop(1.0, "#141209"); // base : sombre
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        38,
        el.clientWidth / el.clientHeight,
        0.1,
        4000,
      );
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      el.appendChild(renderer.domElement);

      // Éclairage image-based réaliste (réflexions/ombrage doux) sans HDR externe.
      const pmrem = new THREE.PMREMGenerator(renderer);
      envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;
      scene.environmentIntensity = 0.35; // fill discret, ne délave pas le stage
      pmrem.dispose();

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: 0.05,
        roughness: 0.5,
      });

      let object: THREE.Object3D;
      try {
        const ext = modelUrl.split(".").pop()?.toLowerCase();
        if (ext === "stl") {
          const { STLLoader } = await import(
            "three/addons/loaders/STLLoader.js"
          );
          const geometry = await new STLLoader().loadAsync(modelUrl);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(geometry, material);
          materialsRef.current = [material];
        } else {
          const { GLTFLoader } = await import(
            "three/addons/loaders/GLTFLoader.js"
          );
          const gltf = await new GLTFLoader().loadAsync(modelUrl);
          object = gltf.scene;
          // Remplace chaque matériau du GLB par un matériau teintable.
          const mats: THREE.MeshStandardMaterial[] = [];
          object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              const m = material.clone();
              mesh.material = m;
              mats.push(m);
            }
          });
          materialsRef.current = mats.length > 0 ? mats : [material];
        }
      } catch {
        if (!disposed) {
          setError(true);
          setLoading(false);
        }
        return;
      }
      if (disposed) return;

      // L'objet projette et reçoit les ombres (relief réaliste).
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      // Centre l'objet, puis le remonte pour que sa base repose à y = 0.
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      object.position.y += size.y / 2;
      scene.add(object);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const footprintR = Math.hypot(size.x, size.z) / 2 || maxDim / 2;
      const podiumRadius = footprintR * 1.5 + maxDim * 0.1;
      const podiumHeight = maxDim * 0.16;
      const floorY = -podiumHeight;

      // Socle clair sur plinthe sombre : se lit nettement sur le stage sombre,
      // et fait ressortir aussi bien les modèles clairs que foncés posés dessus.
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(podiumRadius, podiumRadius * 1.04, podiumHeight, 96),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#cbc7c0"),
          roughness: 0.45,
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

      // Sol sombre brillant : réflexions d'environnement (sheen poli galerie) +
      // reçoit l'ombre de contact. Roughness bas + IBL = reflet doux réaliste.
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(maxDim * 200, maxDim * 200),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#1c1a16"),
          roughness: 0.22,
          metalness: 0.4,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = floorY;
      floor.receiveShadow = true;
      scene.add(floor);

      // Cyclorama : grand cylindre ouvert, face interne, centré sur l'objet pour
      // que le wash lumineux peint tombe derrière lui. Le spot l'éclaire en plus.
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(maxDim * 7, maxDim * 7, maxDim * 16, 64, 1, true),
        new THREE.MeshStandardMaterial({
          map: (wallTexture = makeWallTexture()),
          side: THREE.BackSide,
          roughness: 1,
          metalness: 0,
        }),
      );
      wall.position.y = maxDim * 0.5; // aligne le wash à hauteur d'objet
      wall.receiveShadow = false;
      scene.add(wall);

      const dist = maxDim * 2.8;
      scene.fog = new THREE.Fog(new THREE.Color("#141209"), dist * 2.6, dist * 7);

      // Éclairage galerie : ambiant très bas + spot (clé + ombre) + contour froid
      // (détache l'objet du fond) + remplissage doux de face.
      scene.add(new THREE.AmbientLight(0xffffff, 0.12));
      const spot = new THREE.SpotLight(0xfff4e8, 4.2, 0, 0.62, 0.7, 0);
      spot.position.set(maxDim * 1.4, maxDim * 5, maxDim * 2.6);
      spot.target.position.set(0, size.y * 0.4, 0);
      spot.castShadow = true;
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.radius = 7;
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.02;
      spot.shadow.camera.near = maxDim * 0.5;
      spot.shadow.camera.far = maxDim * 14;
      scene.add(spot.target);
      scene.add(spot);
      const rim = new THREE.DirectionalLight(0xdfe6ff, 1.4);
      rim.position.set(-maxDim * 2.6, maxDim * 2.4, -maxDim * 3.2);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(maxDim * 2, maxDim * 0.6, maxDim * 3);
      scene.add(fill);

      // Cadrage : vue 3/4 légèrement plongeante, orbite autour du centre objet.
      const targetY = size.y * 0.5;
      controls.target.set(0, targetY, 0);
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // reste au-dessus du sol
      controls.minDistance = maxDim * 1.2;
      controls.maxDistance = maxDim * 5.5;
      camera.position.set(dist * 0.68, targetY + maxDim * 0.8, dist * 0.95);
      camera.near = maxDim / 100;
      camera.far = maxDim * 200;
      camera.updateProjectionMatrix();
      controls.update();
      setLoading(false);

      onResize = () => {
        if (!renderer) return;
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener("resize", onResize);

      const animate = () => {
        frame = requestAnimationFrame(animate);
        controls!.update();
        renderer!.render(scene, camera);
      };
      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (onResize) window.removeEventListener("resize", onResize);
      controls?.dispose();
      envTexture?.dispose();
      wallTexture?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
    // `color` n'initialise que le matériau ; le recoloriage vit dans l'effet
    // suivant. On NE veut PAS reconstruire la scène à chaque changement de teinte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  // Recolore le(s) matériau(x) à la volée quand la couleur produit change.
  useEffect(() => {
    for (const m of materialsRef.current) m.color.set(color);
  }, [color]);

  return (
    <div className="relative">
      <div ref={mountRef} className="aspect-square w-full cursor-grab" />
      {/* Pastille permanente : rappelle qu'on est dans la vue interactive 3D */}
      <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
        <Box size={12} />
        {t("badge3d")}
      </span>
      {loading && !error && (
        <div className="absolute inset-0 grid place-items-center text-soft">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-soft">
          {t("error")}
        </div>
      )}
      {!loading && !error && (
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {t("dragHint")}
        </span>
      )}
    </div>
  );
}
