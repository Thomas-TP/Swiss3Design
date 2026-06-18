"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Box, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useProductColor } from "./product-color-context";

// Lit une variable CSS de thème (#hex) pour teinter la scène 3D au ton courant.
function cssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Viewer 3D **embarqué** dans la galerie produit (dernier "slot"). Three.js est
// chargé dynamiquement au montage (hors bundle initial) — la galerie ne monte ce
// composant que lorsque la vignette 3D est sélectionnée, donc le coût n'est payé
// qu'à la demande. La teinte du modèle suit la couleur choisie dans le bloc
// d'achat (contexte partagé) : un seul sélecteur de couleur sur la fiche.
//
// Mise en scène : plutôt qu'un objet flottant, le modèle est posé sur un socle
// dans un mini-studio (sol + ombres portées douces + éclairage clé/remplissage).
// Tout est procédural et teinté aux couleurs du thème → aucun asset externe à
// valider, et s'adapte automatiquement au mode clair/sombre.
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

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/addons/controls/OrbitControls.js"
      );
      if (disposed) return;

      // Couleurs de scène prises sur le thème courant (clair/sombre).
      const floorHex = cssColor("--paper", "#fafaf9");
      const podiumHex = cssColor("--surface", "#ffffff");

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        40,
        el.clientWidth / el.clientHeight,
        0.1,
        1000,
      );
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: 0.05,
        roughness: 0.6,
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
      const podiumRadius = footprintR * 1.35 + maxDim * 0.05;
      const podiumHeight = maxDim * 0.16;

      // Socle (le « meuble ») : cylindre mat, sommet à y = 0 sous l'objet.
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(podiumRadius, podiumRadius * 1.05, podiumHeight, 72),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(podiumHex),
          roughness: 0.85,
          metalness: 0,
        }),
      );
      podium.position.y = -podiumHeight / 2;
      podium.castShadow = true;
      podium.receiveShadow = true;
      scene.add(podium);

      // Sol infini : ancre la scène (fin du « flottement ») et reçoit l'ombre.
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(maxDim * 60, maxDim * 60),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(floorHex),
          roughness: 1,
          metalness: 0,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -podiumHeight;
      floor.receiveShadow = true;
      scene.add(floor);

      // Brume couleur du sol : fond le sol dans l'arrière-plan (sweep studio),
      // évite une ligne d'horizon dure entre sol et fond transparent.
      const dist = maxDim * 2.6;
      scene.fog = new THREE.Fog(new THREE.Color(floorHex), dist * 1.4, dist * 4.5);

      // Éclairage studio : ambiant doux + hémisphérique + clé (ombres) + remplissage.
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      scene.add(
        new THREE.HemisphereLight(0xffffff, new THREE.Color(floorHex), 0.55),
      );
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(maxDim * 2.5, maxDim * 4, maxDim * 2.2);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
      const sc = keyLight.shadow.camera;
      const r = podiumRadius * 2.4;
      sc.left = -r;
      sc.right = r;
      sc.top = r;
      sc.bottom = -r;
      sc.near = maxDim * 0.1;
      sc.far = maxDim * 14;
      keyLight.target.position.set(0, size.y * 0.4, 0);
      scene.add(keyLight.target);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
      fillLight.position.set(-maxDim * 3, maxDim * 1.5, -maxDim * 2.5);
      scene.add(fillLight);

      // Cadrage : vue 3/4 légèrement plongeante, orbite autour du centre objet.
      const targetY = size.y * 0.5;
      controls.target.set(0, targetY, 0);
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // reste au-dessus du sol
      controls.minDistance = maxDim * 1.1;
      controls.maxDistance = maxDim * 5;
      camera.position.set(dist * 0.7, targetY + maxDim * 0.9, dist * 0.95);
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
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
