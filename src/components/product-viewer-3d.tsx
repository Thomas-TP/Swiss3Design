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
// Mise en scène : un mini-studio photo **fixe** (identique en thème clair et
// sombre) — fond dégradé neutre type cyclorama, éclairage image-based réaliste
// (RoomEnvironment), socle gris neutre et sol mat avec ombres portées douces.
// Les tons sont volontairement « 18 % gris » : universels, ils mettent en valeur
// n'importe quel modèle, clair comme foncé, sans que la scène change.
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
    let bgTexture: THREE.Texture | undefined;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/addons/controls/OrbitControls.js"
      );
      const { RoomEnvironment } = await import(
        "three/addons/environments/RoomEnvironment.js"
      );
      if (disposed) return;

      // Dégradé "cyclorama" peint dans un canvas → fond studio fixe (jamais lié
      // au thème). Léger halo radial = spot derrière l'objet.
      const makeBackdrop = (): THREE.Texture => {
        const s = 512;
        const cv = document.createElement("canvas");
        cv.width = s;
        cv.height = s;
        const ctx = cv.getContext("2d")!;
        const grad = ctx.createLinearGradient(0, 0, 0, s);
        grad.addColorStop(0, "#e7e4df");
        grad.addColorStop(0.55, "#d8d4ce");
        grad.addColorStop(1, "#c4bfb8");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
        const halo = ctx.createRadialGradient(
          s * 0.5,
          s * 0.42,
          s * 0.04,
          s * 0.5,
          s * 0.42,
          s * 0.62,
        );
        halo.addColorStop(0, "rgba(255,252,247,0.45)");
        halo.addColorStop(1, "rgba(255,252,247,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, s, s);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };

      const scene = new THREE.Scene();
      bgTexture = makeBackdrop();
      scene.background = bgTexture;

      const camera = new THREE.PerspectiveCamera(
        38,
        el.clientWidth / el.clientHeight,
        0.1,
        2000,
      );
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      el.appendChild(renderer.domElement);

      // Éclairage image-based réaliste (réflexions/ombrage doux) sans fichier HDR.
      const pmrem = new THREE.PMREMGenerator(renderer);
      envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;
      pmrem.dispose();

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: 0.05,
        roughness: 0.55,
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

      // L'objet projette et reçoit les ombres (relief réaliste sur le socle).
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
      const podiumHeight = maxDim * 0.14;

      // Socle (le « meuble ») : cylindre mat gris neutre, sommet à y = 0.
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(podiumRadius, podiumRadius * 1.06, podiumHeight, 96),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#d2cfc9"),
          roughness: 0.5,
          metalness: 0.05,
        }),
      );
      podium.position.y = -podiumHeight / 2;
      podium.castShadow = true;
      podium.receiveShadow = true;
      scene.add(podium);

      // Sol mat neutre : ancre la scène (fin du « flottement ») et reçoit l'ombre.
      // Léger sheen (roughness < 1 + IBL) → reflet doux réaliste.
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(maxDim * 80, maxDim * 80),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#c7c2bb"),
          roughness: 0.6,
          metalness: 0.08,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -podiumHeight;
      floor.receiveShadow = true;
      scene.add(floor);

      const dist = maxDim * 2.8;
      // Brume couleur du bas de fond : fond le sol dans le cyclorama (sweep
      // studio sans ligne d'horizon dure).
      scene.fog = new THREE.Fog(new THREE.Color("#c4bfb8"), dist * 1.5, dist * 5);

      // Éclairage : IBL doux (RoomEnvironment) + clé (ombre) + contour (sépare
      // l'objet du fond, utile pour les modèles très clairs ou très foncés).
      scene.add(new THREE.AmbientLight(0xffffff, 0.15));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
      keyLight.position.set(maxDim * 2.2, maxDim * 4, maxDim * 2.6);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.radius = 8;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
      const sc = keyLight.shadow.camera;
      const r = podiumRadius * 2.6;
      sc.left = -r;
      sc.right = r;
      sc.top = r;
      sc.bottom = -r;
      sc.near = maxDim * 0.1;
      sc.far = maxDim * 16;
      keyLight.target.position.set(0, size.y * 0.4, 0);
      scene.add(keyLight.target);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0xffffff, 1.1);
      rimLight.position.set(-maxDim * 2.4, maxDim * 2.6, -maxDim * 3);
      scene.add(rimLight);

      // Cadrage : vue 3/4 légèrement plongeante, orbite autour du centre objet.
      const targetY = size.y * 0.5;
      controls.target.set(0, targetY, 0);
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // reste au-dessus du sol
      controls.minDistance = maxDim * 1.2;
      controls.maxDistance = maxDim * 5.5;
      camera.position.set(dist * 0.68, targetY + maxDim * 0.85, dist * 0.95);
      camera.near = maxDim / 100;
      camera.far = maxDim * 120;
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
      bgTexture?.dispose();
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
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-medium text-paper">
          {t("dragHint")}
        </span>
      )}
    </div>
  );
}
