"use client";

import { useState } from "react";
import { cfImage } from "@/lib/cf-image";

interface GalleryImage {
  url: string;
  alt: string | null;
}

// Galerie de la page produit : grande image + vignettes (si plusieurs images)
export function ProductGallery({
  images,
  name,
}: {
  images: GalleryImage[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <div className="overflow-hidden rounded-card border border-line bg-gradient-to-br from-paper to-line/40">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cfImage(current.url, { width: 1200 })}
            alt={current.alt ?? name}
            decoding="async"
            fetchPriority="high"
            className="aspect-square w-full object-cover"
          />
        )}
      </div>
      {images.length > 1 && (
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
        </div>
      )}
    </div>
  );
}
