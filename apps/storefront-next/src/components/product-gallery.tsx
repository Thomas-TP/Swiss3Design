"use client";

import { useEffect, useState } from "react";
import { Box } from "lucide-react";
import { useTranslations } from "next-intl";
import { cfImage } from "@/lib/cf-image";
import { ModelViewer } from "./product-viewer-3d";
import { useProductColor } from "./product-color-context";
import { buildShowroomScene } from "./showroom-scene";

interface GalleryImage {
  url: string;
  alt: string | null;
}

// Galerie de la page produit : grande image + vignettes. Quand le produit a un
// modèle 3D, celui-ci devient le **dernier slot** de la galerie — une vignette
// qui, sélectionnée, remplace la grande image par le viewer interactif. Plus de
// bouton « Voir en 3D » séparé : la 3D vit parmi les images. La vignette est un
// **vrai rendu de la scène 3D** (snapshot hors-écran de `showroom-scene`), pas
// la photo produit. La teinte du modèle suit la couleur du bloc d'achat.
export function ProductGallery({
  images,
  name,
  model3dUrl,
}: {
  images: GalleryImage[];
  name: string;
  model3dUrl?: string | null;
}) {
  const t = useTranslations("viewer");
  const { colors } = useProductColor();
  const has3d = Boolean(model3dUrl);
  // Le slot 3D occupe l'index juste après la dernière image.
  const slot3dIndex = images.length;
  const slotCount = images.length + (has3d ? 1 : 0);

  const [index, setIndex] = useState(0);
  const is3d = has3d && index === slot3dIndex;
  const current = images[index] ?? images[0];

  // Vignette 3D : on rend une fois la scène showroom hors-écran et on capture
  // l'image (toDataURL). Donne un aperçu fidèle de la visualisation interactive.
  const [thumb3d, setThumb3d] = useState<string | null>(null);
  useEffect(() => {
    if (!model3dUrl) return;
    let cancelled = false;
    (async () => {
      const THREE = await import("three");
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(384, 384);
        const built = await buildShowroomScene(
          renderer,
          model3dUrl,
          colors[0]?.hex ?? "#E5231C",
          1,
        );
        renderer.render(built.scene, built.camera);
        const url = renderer.domElement.toDataURL("image/png");
        built.dispose();
        if (!cancelled) setThumb3d(url);
      } catch {
        // En cas d'échec, la vignette de repli (dégradé + badge) reste affichée.
      } finally {
        // Toujours libérer le contexte WebGL hors-écran (ressource limitée).
        renderer.dispose();
        renderer.forceContextLoss();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Snapshot unique : couleur par défaut, ne se régénère pas au changement de teinte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model3dUrl]);

  return (
    <div>
      <div className="overflow-hidden rounded-card border border-line bg-gradient-to-br from-paper to-line/40">
        {is3d && model3dUrl ? (
          <ModelViewer modelUrl={model3dUrl} />
        ) : (
          current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfImage(current.url, { width: 1200 })}
              alt={current.alt ?? name}
              decoding="async"
              fetchPriority="high"
              className="aspect-square w-full object-cover"
            />
          )
        )}
      </div>
      {slotCount > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${name} ${i + 1}/${images.length}`}
              aria-current={i === index}
              className={`overflow-hidden rounded-xl border bg-surface transition-colors ${
                i === index ? "border-ink" : "border-line hover:border-ink/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cfImage(img.url, { width: 200 })}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
          {has3d && (
            <button
              type="button"
              onClick={() => setIndex(slot3dIndex)}
              aria-label={t("view3d")}
              aria-current={is3d}
              className={`relative overflow-hidden rounded-xl border bg-surface transition-colors ${
                is3d ? "border-ink" : "border-line hover:border-ink/40"
              }`}
            >
              {thumb3d ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb3d}
                  alt=""
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="block aspect-square w-full animate-pulse bg-gradient-to-br from-ink/80 to-black" />
              )}
              {/* Petite pastille : signale une visualisation 3D interactive. */}
              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                <Box size={9} />
                3D
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
