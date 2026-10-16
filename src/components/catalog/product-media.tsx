"use client";

import { useState, ViewTransition } from "react";
import { Rotate3d } from "lucide-react";
import { useTranslations } from "next-intl";
import { cfImage } from "@/lib/cf-image";
import { cx } from "@/components/ui/cx";
import { ProductViewer, ViewerCredits } from "./product-viewer";
import "./morph.css";

interface MediaImage {
  url: string;
  alt: string | null;
}

// Tête de la fiche (chapitre 01, demande du 16.10.2026 : « mettre la 3D plus en
// avant ») : la pièce en 3D d'abord, à côté du bloc d'achat, posée sur une
// table, et repeinte en direct par le choix de la couleur ; les photos juste
// dessous, en vignettes, la vignette « 3D » en tête. Avant, la 3D vivait dans son
// propre chapitre, sous la ligne de flottaison, loin du sélecteur de couleur.
//
// Le cadre porte le nom de transition `product-<slug>` : la photo de la carte
// de la boutique vient s'y poser (« morph », §3.4), et c'est la même photo qui
// sert de poster à la 3D (élément LCP, `fetchPriority="high"`) tant qu'elle
// charge, au premier moment libre du navigateur.
export function ProductMedia({
  images,
  name,
  slug,
  modelUrl,
  sizeHint,
  author,
}: {
  images: MediaImage[];
  name: string;
  slug: string;
  modelUrl: string;
  sizeHint?: number;
  /** Auteur du modèle (légende « fichier original de … »). */
  author: string;
}) {
  const t = useTranslations("catalog.viewer");
  // null = la 3D ; sinon l'indice de la photo montrée.
  const [photo, setPhoto] = useState<number | null>(null);
  const poster = images[0] ?? null;
  const current = photo === null ? null : (images[photo] ?? null);

  const thumb = (active: boolean) =>
    cx(
      "overflow-hidden rounded-field border bg-surface transition-colors duration-150 ease-strate",
      active ? "border-ink" : "border-line hover:border-iso",
    );

  return (
    <div>
      <ViewTransition name={`product-${slug}`} share="morph" default="none">
        {/* Transparent en 3D : la scène est peinte par le canvas du Stage,
          DERRIÈRE la page ; un fond ici la cacherait. */}
        <div
          className={cx(
            "relative aspect-square overflow-hidden rounded-card border border-line",
            current && "bg-surface",
          )}
        >
          {current ? (
            <img
              src={cfImage(current.url, { width: 1200 })}
              alt={current.alt ?? name}
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <ProductViewer
              name={name}
              modelUrl={modelUrl}
              sizeHint={sizeHint}
              poster={poster}
              eager
            />
          )}
        </div>
      </ViewTransition>

      <div className="mt-3 grid grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setPhoto(null)}
          aria-current={photo === null}
          aria-label={t("view3d")}
          className={cx(
            thumb(photo === null),
            "flex aspect-square flex-col items-center justify-center gap-1 text-ink",
          )}
        >
          <Rotate3d size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="s3d-label">3D</span>
        </button>
        {images.slice(0, 4).map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setPhoto(i)}
            aria-label={`${name} ${i + 1}/${images.length}`}
            aria-current={photo === i}
            className={thumb(photo === i)}
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

      {photo === null ? (
        <ViewerCredits caption={t("caption", { author })} className="mt-3" />
      ) : null}
    </div>
  );
}
