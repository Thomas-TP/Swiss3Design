"use client";

import { useState } from "react";
import { Box } from "lucide-react";
import { useTranslations } from "next-intl";
import { cfImage } from "@/lib/cf-image";
import { ModelViewer } from "./product-viewer-3d";

interface GalleryImage {
  url: string;
  alt: string | null;
}

// Galerie de la page produit : grande image + vignettes. Quand le produit a un
// modèle 3D, celui-ci devient le **dernier slot** de la galerie — une vignette
// (la 1re image assombrie + badge « 3D ») qui, sélectionnée, remplace la grande
// image par le viewer interactif. Plus de bouton « Voir en 3D » séparé : la 3D
// vit parmi les images, signalée par son badge. La teinte du modèle suit la
// couleur choisie dans le bloc d'achat (contexte ProductColor).
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
  const has3d = Boolean(model3dUrl);
  // Le slot 3D occupe l'index juste après la dernière image.
  const slot3dIndex = images.length;
  const slotCount = images.length + (has3d ? 1 : 0);

  const [index, setIndex] = useState(0);
  const is3d = has3d && index === slot3dIndex;
  const current = images[index] ?? images[0];
  // Vignette du slot 3D : on réutilise la 1re photo du produit, assombrie, pour
  // donner un aperçu « du modèle » sans rendu 3D coûteux dans la grille.
  const thumb3dSrc = images[0]?.url;

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
              {thumb3dSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cfImage(thumb3dSrc, { width: 200 })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="block aspect-square w-full bg-gradient-to-br from-paper to-line/40" />
              )}
              {/* Voile + pastille : signale une visualisation 3D interactive. */}
              <span className="absolute inset-0 grid place-items-center bg-ink/45">
                <span className="flex items-center gap-1 rounded-full bg-surface/95 px-2 py-1 text-[10px] font-bold text-ink shadow-sm">
                  <Box size={11} />
                  3D
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
