import { For, Show, createSignal } from "solid-js";

interface GalleryImage {
  url: string;
  alt: string | null;
}

// Galerie de la fiche produit : grande image + vignettes. Miroir simplifié de
// product-gallery.tsx côté app Next.js - le viewer 3D (Three.js) qui occupait
// le dernier slot de la galerie n'est pas encore porté (comme la scène 3D de
// la homepage), cf. plan Phase 5. Reste à ajouter quand le reste des pages
// fonctionnelles sera construit.
export function ProductGallery(props: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = createSignal(0);
  const current = () => props.images[index()] ?? props.images[0];

  return (
    <div>
      <div class="overflow-hidden rounded-card border border-line bg-gradient-to-br from-paper to-line/40">
        <Show when={current()}>
          {(img) => (
            <img
              src={img().url}
              alt={img().alt ?? props.name}
              decoding="async"
              fetchpriority="high"
              class="aspect-square w-full object-cover"
            />
          )}
        </Show>
      </div>
      <Show when={props.images.length > 1}>
        <div class="mt-3 grid grid-cols-5 gap-3">
          <For each={props.images}>
            {(img, i) => (
              <button
                type="button"
                onClick={() => setIndex(i())}
                aria-label={`${props.name} ${i() + 1}/${props.images.length}`}
                aria-current={i() === index()}
                class={`overflow-hidden rounded-xl border bg-surface transition-colors ${
                  i() === index() ? "border-ink" : "border-line hover:border-ink/40"
                }`}
              >
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="aspect-square w-full object-cover"
                />
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
