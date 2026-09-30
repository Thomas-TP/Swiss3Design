"use client";

import { useState, ViewTransition } from "react";
import { cfImage } from "@/lib/cf-image";
import { cx } from "@/components/ui/cx";
import "@/components/catalog/morph.css";

interface GalleryImage {
  url: string;
  alt: string | null;
}

// Galerie de la fiche (brief « Strates », §7.9, chapitre 01) : la grande photo
// et ses vignettes, rien d'autre. Plus de vignette 3D : le modèle vit dans son
// propre chapitre (« Tourner », product-viewer.tsx), où il a la place de
// tourner. La grande photo porte `fetchPriority="high"` (c'est l'élément LCP) et
// le nom de transition `product-<slug>` : la photo de la carte de la boutique
// vient s'y poser (« morph », §3.4).
export function ProductGallery({
  images,
  name,
  slug,
}: {
  images: GalleryImage[];
  name: string;
  slug: string;
}) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <ViewTransition name={`product-${slug}`} share="morph" default="none">
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {current && (
            <img
              src={cfImage(current.url, { width: 1200 })}
              alt={current.alt ?? name}
              decoding="async"
              fetchPriority="high"
              className="aspect-square w-full object-cover"
            />
          )}
          {!current && <div className="aspect-square w-full" />}
        </div>
      </ViewTransition>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${name} ${i + 1}/${images.length}`}
              aria-current={i === index}
              className={cx(
                "overflow-hidden rounded-field border bg-surface transition-colors duration-150 ease-strate",
                i === index ? "border-ink" : "border-line hover:border-iso",
              )}
            >
              <img
                src={cfImage(img.url, { width: 200 })}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
