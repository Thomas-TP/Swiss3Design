"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Rotate3d,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cfImage } from "@/lib/cf-image";
import { useMotionBridge } from "@/lib/motion-bridge/store";
import { useReducedMotionPreference } from "@/lib/motion-bridge/use-reduced-motion";
import { useOptionalProductColor } from "@/components/product-color-context";
import { StageView } from "@/components/ui/stage-view";
import { cx } from "@/components/ui/cx";
import {
  DINING_ROOM_DECOR,
  VIEWER_FALLBACK_COLOR,
  VIEWER_TURN_EVENT,
  type ProductViewerProps,
  type ViewerModelFile,
  type ViewerStatus,
  type ViewerTurnDetail,
} from "./viewer-props";

// Vue 3D d'une pièce (brief « Strates », §7.9), posée sur la table d'une salle à
// manger (décor CC BY 4.0, crédité par <ViewerCredits>) : le fichier ORIGINAL du
// design, rendu en temps réel, que l'on fait tourner. Rien d'autre : pas de zoom,
// pas de coupe, pas de shader d'impression, pas de teinte hors des couleurs
// réellement vendues (CC BY-ND 4.0 de Ian : montrer et faire tourner, jamais
// transformer). La vue est une vue du Stage (un seul contexte WebGL par page) ; la
// scène vit côté lourd, ce composant n'en sait que le contrat (viewer-props.ts).
//
// Deux usages : en tête de la fiche produit (ProductMedia, à côté du choix de la
// couleur, qui la repeint en direct) et l'aperçu du fichier de « Sur mesure »
// (le fichier du visiteur, lu dans son navigateur, dans les couleurs choisies).
//
// Chargement : la vue n'est déclarée au pont qu'une fois « près » (à un écran de
// distance, ou, en tête de page, dès que le navigateur est libre : la photo du
// poster reste l'élément LCP). Le poster occupe la place dès le premier paint
// (aucun décalage) et reste la seule image là où la 3D n'est pas possible (C0 :
// WebGL absent, économie de données, contexte perdu) ; il s'efface quand la
// scène a rendu sa première image.

// « Près » = à moins d'un écran de la vue : le temps de charger Three, la scène,
// le décor et le modèle avant que le visiteur n'y arrive.
const NEAR_MARGIN = "100% 0px";
/** En tête de page : chargement au premier moment libre, au plus tard après 1,5 s. */
const IDLE_TIMEOUT_MS = 1500;

const MIB = 1024 * 1024;

export function ProductViewer({
  name,
  modelUrl,
  modelFile,
  sizeHint,
  poster = null,
  colors: forcedColors,
  eager = false,
  className,
}: {
  /** Nom de la pièce (nom accessible de la vue, alternative du poster). */
  name: string;
  modelUrl?: string;
  /** Fichier déjà en mémoire (aperçu de « Sur mesure ») : l'emporte sur l'URL. */
  modelFile?: ViewerModelFile;
  /** Taille du modèle quand le serveur ne la donne pas (attente narrée « ≈ 2,2 Mo »). */
  sizeHint?: number;
  poster?: { url: string; alt: string | null } | null;
  /** Teintes imposées (aperçu de « Sur mesure ») ; sinon la couleur choisie sur la fiche. */
  colors?: readonly string[];
  /** En tête de page : chargé dès que le navigateur est libre, poster prioritaire. */
  eager?: boolean;
  className?: string;
}) {
  const t = useTranslations("catalog.viewer");
  const locale = useLocale();
  const productColor = useOptionalProductColor();
  const reduced = useReducedMotionPreference();
  const stageAvailable = useMotionBridge(
    (s) => s.capability >= 1 && !s.contextLost,
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<ViewerStatus>({
    state: "idle",
    receivedBytes: 0,
    totalBytes: null,
  });

  useEffect(() => {
    if (eager) {
      // En tête de page : la photo d'abord (LCP), la 3D au premier moment libre.
      const idle = window.requestIdleCallback;
      if (idle) {
        const handle = idle(() => setNear(true), { timeout: IDLE_TIMEOUT_MS });
        return () => window.cancelIdleCallback(handle);
      }
      const timer = window.setTimeout(() => setNear(true), 300);
      return () => window.clearTimeout(timer);
    }
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
  }, [eager]);

  // Une bobine réellement vendue (ses 1 à 3 teintes), ou à défaut un blanc
  // neutre : jamais une teinte libre (le viewer ne « colorie » rien qui ne soit
  // au catalogue). La clé texte garde les props stables d'un rendu à l'autre.
  const chosen = productColor
    ? (productColor.selected ?? productColor.colors[0] ?? null)
    : null;
  const tints = forcedColors?.length
    ? forcedColors.join(",")
    : chosen
      ? (chosen.hexes.length > 0 ? chosen.hexes : [chosen.hex]).join(",")
      : VIEWER_FALLBACK_COLOR;
  const viewProps = useMemo<ProductViewerProps>(
    () => ({
      modelUrl,
      modelFile,
      colors: tints.split(","),
      autoRotate: !reduced,
      decor: DINING_ROOM_DECOR,
      onStatus: setStatus,
    }),
    [modelUrl, modelFile, tints, reduced],
  );

  const ready = status.state === "ready";
  const loading = status.state === "loading";

  const total = status.totalBytes ?? sizeHint ?? null;
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
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      // Un glisser sur la vue fait tourner la pièce : jamais le glisser natif de
      // l'image (qui volait le geste et traînait la photo à l'écran).
      draggable={false}
      className="h-full w-full object-cover"
    />
  ) : null;

  // Les boutons passent par un événement DOM sur la vue : le DOM n'importe rien
  // du côté lourd, la scène écoute l'élément qu'elle contrôle.
  const turn =
    (
      step: ViewerTurnDetail["step"],
      axis: ViewerTurnDetail["axis"] = "around",
    ) =>
    (event: MouseEvent) => {
      setTouched(true);
      event.currentTarget.closest("[data-stage-view]")?.dispatchEvent(
        new CustomEvent<ViewerTurnDetail>(VIEWER_TURN_EVENT, {
          detail: { step, axis },
        }),
      );
    };
  const controlClass =
    "grid h-10 w-10 place-items-center rounded-field border border-ink/80 bg-paper/85 text-ink backdrop-blur-sm transition-colors duration-150 ease-strate hover:bg-ink hover:text-paper";

  return (
    <div
      ref={wrapRef}
      className={cx("relative h-full w-full", className)}
      // Premier geste sur la vue : l'invitation « Glisser pour tourner » s'efface.
      onPointerDownCapture={() => setTouched(true)}
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
              className="s3d-label ph-no-capture absolute bottom-3 left-3 flex items-center gap-2 rounded-hair bg-paper/85 px-2 py-1 normal-case text-ink"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {loadingText}
            </p>
          )}
          {ready && (
            <p
              aria-hidden="true"
              className={cx(
                "s3d-label pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-hair bg-paper/85 px-2 py-1 normal-case text-ink backdrop-blur-sm transition-opacity duration-300 ease-strate",
                touched && "opacity-0",
              )}
            >
              <Rotate3d size={14} strokeWidth={1.5} />
              {t("hint")}
            </p>
          )}
          {ready && (
            <div
              data-no-orbit=""
              className="absolute bottom-3 right-3 flex gap-1.5"
            >
              {/* Hauteur : le seul moyen de passer au-dessus de la pièce au
                doigt (glisser verticalement fait défiler la page). */}
              <button
                type="button"
                onClick={turn(-1, "height")}
                aria-label={t("tiltUp")}
                className={controlClass}
              >
                <ChevronUp size={17} />
              </button>
              <button
                type="button"
                onClick={turn(1, "height")}
                aria-label={t("tiltDown")}
                className={controlClass}
              >
                <ChevronDown size={17} />
              </button>
              <button
                type="button"
                onClick={turn(-1)}
                aria-label={t("turnLeft")}
                className={controlClass}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={turn(1)}
                aria-label={t("turnRight")}
                className={controlClass}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </StageView>
      ) : (
        <div className="absolute inset-0">{posterImage}</div>
      )}
      {/* Annonce lecteur d'écran : le canvas est muet (aria-hidden). */}
      <output className="sr-only">
        {ready ? t("ready") : loading ? loadingText : ""}
      </output>
    </div>
  );
}

/**
 * Légendes de la vue : le fichier montré et le crédit du décor (exigé par sa
 * licence, CC BY 4.0 : titre, auteur, source, licence et mention de l'adaptation).
 */
export function ViewerCredits({
  caption,
  className,
}: {
  /** Ce que montre la vue (« Rendu temps réel du fichier original de … »). */
  caption: string;
  className?: string;
}) {
  const t = useTranslations("catalog.viewer");
  const locale = useLocale();
  const credit = DINING_ROOM_DECOR.credit;
  const link =
    "underline decoration-iso-index decoration-1 underline-offset-4 hover:decoration-ink";
  return (
    <p className={cx("text-xs leading-relaxed text-soft", className)}>
      {caption}{" "}
      {t.rich("decorCredit", {
        title: credit.title,
        author: credit.author,
        license: credit.license,
        source: (chunks) => (
          <a href={credit.url} rel="noopener" target="_blank" className={link}>
            {chunks}
          </a>
        ),
        deed: (chunks) => (
          <a
            href={`${credit.licenseUrl}deed.${locale}`}
            rel="noopener license"
            target="_blank"
            className={link}
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
