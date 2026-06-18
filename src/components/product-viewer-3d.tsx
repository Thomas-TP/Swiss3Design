"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Box, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useProductColor } from "./product-color-context";
import { buildShowroomScene, type ShowroomScene } from "./showroom-scene";

// Viewer 3D **embarqué** dans la galerie produit (dernier "slot"). Three.js est
// chargé dynamiquement au montage (hors bundle initial) — la galerie ne monte ce
// composant que lorsque la vignette 3D est sélectionnée. La teinte du modèle
// suit la couleur choisie dans le bloc d'achat (contexte partagé) : un seul
// sélecteur de couleur sur la fiche. La mise en scène (pièce galerie meublée,
// éclairage, socle…) vit dans `showroom-scene.ts`, partagée avec la vignette.
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
    let built: ShowroomScene | undefined;
    let onResize: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/addons/controls/OrbitControls.js"
      );
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);

      try {
        built = await buildShowroomScene(
          renderer,
          modelUrl,
          color,
          el.clientWidth / el.clientHeight,
        );
      } catch {
        if (!disposed) {
          setError(true);
          setLoading(false);
        }
        return;
      }
      if (disposed) {
        built.dispose();
        return;
      }
      materialsRef.current = built.tintMaterials;

      const { scene, camera, target, maxDim } = built;
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.target.copy(target);
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // reste au-dessus du sol
      controls.minDistance = maxDim * 1.2;
      controls.maxDistance = maxDim * 5.2;
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
      built?.dispose();
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
