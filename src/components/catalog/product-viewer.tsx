"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cfImage } from "@/lib/cf-image";
import { useMotionBridge } from "@/lib/motion-bridge/store";
import { useReducedMotionPreference } from "@/lib/motion-bridge/use-reduced-motion";
import { useProductColor } from "@/components/product-color-context";
import { StageView } from "@/components/ui/stage-view";
import { cx } from "@/components/ui/cx";
import {
  MODEL_SIZE_HINTS,
  VIEWER_FALLBACK_COLOR,
  VIEWER_TURN_EVENT,
  type ProductViewerProps,
  type ViewerStatus,
  type ViewerTurnDetail,
} from "./viewer-props";

// Chapitre « Tourner » de la fiche (brief « Strates », §7.9) : le fichier ORIGINAL
// du design, rendu en temps réel, que l'on fait tourner. C'est tout : pas de
// zoom, pas de coupe, pas de shader d'impression, pas de ligne de couche, pas
// de teinte hors des couleurs réellement vendues (CC BY-ND 4.0 de Ian : montrer
// et faire tourner, jamais transformer). La vue est une vue du Stage (un seul
// contexte WebGL par page) ; la scène vit côté lourd, ce composant n'en sait
// que le contrat (viewer-props.ts).
//
// Chargement : tant que la section est loin (marge 100 % de l'écran), la vue
// n'est même pas déclarée au pont, donc ni Three ni le STL ne sont demandés : la
// page d'achat, au-dessus, n'en paie rien. Le poster SSR (la photo de la pièce)
// occupe la place dès le premier paint (aucun décalage) et reste la seule image
// là où la 3D n'est pas possible (C0 : WebGL absent, économie de données,
// contexte perdu) ; il s'efface quand la scène a rendu sa première image.

// « Près » = à moins d'un écran de la section : le temps de charger Three, la
// scène, puis le STL (≈ 2,2 Mo) avant que le visiteur n'y arrive.
const NEAR_MARGIN = "100% 0px";

const MIB = 1024 * 1024;

export function ProductViewer({
  slug,
  name,
  modelUrl,
  poster,
  author,
}: {
  slug: string;
  name: string;
  modelUrl: string;
  poster: { url: string; alt: string | null } | null;
  /** Auteur du modèle (légende « fichier original de … »). */
  author: string;
}) {
  const t = useTranslations("catalog.viewer");
  const locale = useLocale();
  const { selected, colors } = useProductColor();
  const reduced = useReducedMotionPreference();
  const stageAvailable = useMotionBridge(
    (s) => s.capability >= 1 && !s.contextLost,
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [status, setStatus] = useState<ViewerStatus>({
    state: "idle",
    receivedBytes: 0,
    totalBytes: null,
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Navigateur sans observateur : on déclare la vue tout de suite.
      const timer = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Une couleur réellement vendue, ou à défaut un blanc neutre : jamais une
  // teinte libre (le viewer ne « colorie » rien qui ne soit au catalogue).
  const color = selected?.hex ?? colors[0]?.hex ?? VIEWER_FALLBACK_COLOR;
  const viewProps = useMemo<ProductViewerProps>(
    () => ({ modelUrl, color, autoRotate: !reduced, onStatus: setStatus }),
    [modelUrl, color, reduced],
  );

  const ready = status.state === "ready";
  const loading = status.state === "loading";
  const failed = status.state === "error";

  const total = status.totalBytes ?? MODEL_SIZE_HINTS[slug] ?? null;
  const loadingText = total
    ? t("loadingSize", {
        size: new Intl.NumberFormat(`${locale}-CH`, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(total / MIB),
      })
    : t("loading");

  const posterImage = poster ? (
    <img
      src={cfImage(poster.url, { width: 1200 })}
      alt={poster.alt ?? name}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain p-6 sm:p-10"
    />
  ) : null;

  // Les boutons « Tourner » passent par un événement DOM sur la vue : le DOM
  // n'importe rien du côté lourd, la scène écoute l'élément qu'elle contrôle.
  const turn = (step: ViewerTurnDetail["step"]) => (event: MouseEvent) => {
    event.currentTarget.closest("[data-stage-view]")?.dispatchEvent(
      new CustomEvent<ViewerTurnDetail>(VIEWER_TURN_EVENT, {
        detail: { step },
      }),
    );
  };

  const caption = ready
    ? t("caption", { author })
    : failed
      ? t("error")
      : t("poster");

  return (
    <figure className="mt-10">
      <div
        ref={wrapRef}
        className="relative h-[clamp(24rem,72svh,46rem)] w-full"
      >
        {near ? (
          <StageView
            scene="product-viewer"
            props={viewProps}
            clear="tone"
            interactive={stageAvailable}
            bakeWhenIdle
            touch="pan-y"
            label={t("label", { name })}
            poster={posterImage}
            className={cx(
              "h-full w-full select-none",
              stageAvailable &&
                "cursor-grab focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink active:cursor-grabbing",
            )}
          >
            {loading && (
              <p
                aria-hidden="true"
                className="s3d-label ph-no-capture absolute bottom-4 left-[var(--spacing-margin)] flex items-center gap-2 rounded-hair bg-paper/85 px-2 py-1 normal-case text-ink"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                {loadingText}
              </p>
            )}
            {ready && (
              <div
                data-no-orbit=""
                className="absolute bottom-4 right-[var(--spacing-margin)] flex gap-2"
              >
                <button
                  type="button"
                  onClick={turn(-1)}
                  aria-label={t("turnLeft")}
                  className="grid h-11 w-11 place-items-center rounded-field border border-ink bg-paper/85 text-ink transition-colors duration-150 ease-strate hover:bg-ink hover:text-paper"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={turn(1)}
                  aria-label={t("turnRight")}
                  className="grid h-11 w-11 place-items-center rounded-field border border-ink bg-paper/85 text-ink transition-colors duration-150 ease-strate hover:bg-ink hover:text-paper"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </StageView>
        ) : (
          <div className="relative h-full w-full">
            <div className="absolute inset-0">{posterImage}</div>
          </div>
        )}
        {/* Annonce lecteur d'écran : le canvas est muet (aria-hidden). */}
        <output className="sr-only">
          {ready ? t("ready") : loading ? loadingText : ""}
        </output>
      </div>
      <figcaption className="s3d-page mt-4 text-sm text-soft">
        {caption}
      </figcaption>
    </figure>
  );
}
