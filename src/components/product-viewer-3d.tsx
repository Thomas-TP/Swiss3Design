"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Box, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface Swatch {
  name: string;
  hex: string;
}

// Viewer 3D **embarqué** dans la galerie produit (dernier "slot"). Three.js est
// chargé dynamiquement au montage (hors bundle initial) — la galerie ne monte ce
// composant que lorsque la vignette 3D est sélectionnée, donc le coût n'est payé
// qu'à la demande. Le modèle (.stl géométrie pure, ou .glb) est teinté dans la
// couleur choisie parmi celles proposées par le produit.
export function ModelViewer({
  modelUrl,
  colors,
}: {
  modelUrl: string;
  colors: Swatch[];
}) {
  const t = useTranslations("viewer");
  const mountRef = useRef<HTMLDivElement>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const [color, setColor] = useState(colors[0]?.hex ?? "#E5231C");
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

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45,
        el.clientWidth / el.clientHeight,
        0.1,
        1000,
      );
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 1.3);
      key.position.set(3, 5, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.4);
      fill.position.set(-4, -2, -4);
      scene.add(fill);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: 0.05,
        roughness: 0.65,
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

      // Centre + cadre la caméra sur le modèle quelle que soit son échelle.
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 2.2;
      camera.position.set(dist * 0.6, dist * 0.4, dist);
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();
      controls.update();
      scene.add(object);
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
    // suivant. On NE veut PAS recharger le modèle à chaque changement de teinte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  // Recolore le(s) matériau(x) à la volée quand la pastille change.
  useEffect(() => {
    for (const m of materialsRef.current) m.color.set(color);
  }, [color]);

  return (
    <>
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

      {colors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
          <span className="text-xs font-medium text-soft">{t("colorLabel")}</span>
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setColor(c.hex)}
              title={c.name}
              aria-label={c.name}
              aria-pressed={color === c.hex}
              className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                color === c.hex
                  ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-surface"
                  : "border-swatch-ring"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      )}
    </>
  );
}
