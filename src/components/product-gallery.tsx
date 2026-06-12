"use client";

import { useState } from "react";

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
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt ?? name}
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
                src={img.url}
                alt=""
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
