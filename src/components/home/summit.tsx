"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { MeasureStrip } from "@/components/ui/measure-strip";
import type { StudioObjectViewProps } from "@/lib/motion-bridge/types";
import {
  clearStudioTexts,
  readStudioTexts,
  writeStudioTexts,
} from "@/lib/studio/texts-store";
import type { ReliefConfig } from "@/lib/studio/types";
import { SummitEngine } from "@/gates/home";
import { HOME_VIEW_ATTR } from "./contract";
import type { HomeLocale } from "./home-data-types";
import type { ReliefTools } from "./summit-tools";
import { statsItems } from "./stats-items";
import { useHomeMotion, useHomeView } from "./use-home-motion";
import styles from "./home.module.css";

// Chapitre 02 « Votre nom, en relief. Littéralement. » (brief « Strates »,
// §7.5) : le visiteur nomme son sommet, l'étiquette du sous-verre « Relief » se
// réécrit à chaque frappe (debounce 120 ms), la bande de mesure suit, et le
// texte arrive au Studio par sessionStorage, jamais par l'URL.
//
// Le texte ne part nulle part : aucune requête, aucun événement analytics,
// aucun formulaire ; le champ n'est pas dans un <form>, tout élément qui
// l'affiche porte .ph-mask, et PostHog masque les champs de saisie. Il vit en
// mémoire de la page et dans `sessionStorage["s3d-studio-texts-v1"]` (texts-
// store) jusqu'à l'envoi à l'atelier. Le champ est hors de toute section
// épinglée (un seul pin sur le site : le héros).
//
// L'étiquette et les chiffres exacts viennent du modèle du sous-verre
// (`peakLabel`, `computeStats`), trop lourd pour le JavaScript initial : il
// n'est chargé (import asynchrone) que lorsque la section approche (marge
// 150 %). Avant lui, et tant que le champ est vide, la page montre ceux de
// l'exemple, calculés par le serveur.

interface SummitValue {
  raw: string;
  setRaw(value: string): void;
  /** Sommet affiché (debounce 120 ms), l'exemple tant que le champ est vide. */
  peak: string;
  label: string;
  items: string[];
  config: ReliefConfig;
}

const SummitContext = createContext<SummitValue | null>(null);

function useSummit(): SummitValue {
  const value = useContext(SummitContext);
  if (!value) throw new Error("useSummit : hors de <SummitProvider>.");
  return value;
}

const DEBOUNCE_MS = 120;

export function SummitProvider({
  config,
  example,
  initialLabel,
  initialItems,
  children,
}: {
  config: ReliefConfig;
  example: string;
  initialLabel: string;
  initialItems: string[];
  children: ReactNode;
}) {
  const locale = useLocale() as HomeLocale;
  const tu = useTranslations("studioCore.units");
  const [raw, setRawState] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tools, setTools] = useState<ReliefTools | null>(null);
  const [near, setNear] = useState(false);
  const touched = useRef(false);

  const setRaw = useCallback((value: string) => {
    touched.current = true;
    setRawState(value);
  }, []);

  // Un sommet saisi plus tôt dans la session (retour du Studio, par exemple) :
  // sessionStorage n'existe qu'après l'hydratation, on le lit donc ici.
  // oxlint-disable set-state-in-effect -- lecture d'un stockage externe, une fois
  useEffect(() => {
    const saved = readStudioTexts("relief").peak;
    if (!saved) return;
    setRawState(saved);
    setDebounced(saved);
  }, []);
  // oxlint-enable set-state-in-effect

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(raw), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [raw]);

  // Le texte rejoint le Studio par sessionStorage, jamais par l'URL.
  useEffect(() => {
    if (!touched.current) return;
    const clean = debounced.trim();
    if (clean) writeStudioTexts("relief", { peak: clean });
    else clearStudioTexts("relief");
  }, [debounced]);

  // Modèle du sous-verre : le moteur (gate de l'accueil, chunk à part) n'est
  // monté que lorsque la section approche (marge 150 %).
  useEffect(() => {
    const section = document.getElementById("sommet");
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setNear(true);
      },
      { rootMargin: "150% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  const typed = debounced.trim();
  const peak = typed || example;
  const label = useMemo(
    () => (tools && typed ? tools.peakLabel(typed, locale) : initialLabel),
    [tools, typed, locale, initialLabel],
  );
  const items = useMemo(
    () =>
      tools && typed
        ? statsItems(
            tools.computeStats(config, { peak: typed }, undefined, locale),
            locale,
            tu as Parameters<typeof statsItems>[2],
          )
        : initialItems,
    [tools, typed, config, locale, tu, initialItems],
  );

  const value = useMemo<SummitValue>(
    () => ({ raw, setRaw, peak, label, items, config }),
    [raw, setRaw, peak, label, items, config],
  );
  return (
    <SummitContext.Provider value={value}>
      {near ? <SummitEngine onReady={setTools} /> : null}
      {children}
    </SummitContext.Provider>
  );
}

/** Champ, note, bande de mesure et CTA de la moitié « texte » du chapitre. */
export function SummitInput({
  href,
  maxLength,
}: {
  href: string;
  maxLength: number;
}) {
  const t = useTranslations("landing.summit");
  const tex = useTranslations("studioCore.examples");
  const { raw, setRaw, items } = useSummit();

  return (
    <div className="mt-8">
      <label htmlFor="summit-input" className="s3d-label block text-soft">
        {t("input")}
      </label>
      <input
        id="summit-input"
        type="text"
        value={raw}
        maxLength={maxLength}
        placeholder={tex("peak")}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        aria-describedby="summit-note"
        onChange={(event) => setRaw(event.currentTarget.value)}
        className="ph-mask mt-2 h-12 w-full max-w-sm rounded-field border border-line bg-elevated px-4 text-base text-ink placeholder:text-soft focus:border-ink"
      />
      <p id="summit-note" className="mt-3 max-w-[40ch] text-sm text-soft">
        {t("note")}
      </p>
      <MeasureStrip items={items} live className="mt-6" />
      <ButtonLink href={href} variant="primary" size="lg" className="mt-8">
        {t("cta")}
      </ButtonLink>
    </div>
  );
}

/**
 * La moitié « vue » : une vue du Stage (`studio-object`, la scène de
 * WP-STUDIO) dont le conteneur est le fils direct d'un bloc « encre » : quand la
 * vue est prête, ce bloc devient transparent et la vue peint elle-même le fond
 * encre. Poster SSR : le massif en strates, vu de dessus. Étiquette en DOM,
 * mise à jour en direct (c'est aussi tout ce que voient mouvement réduit et C0).
 */
export function SummitStage({ poster }: { poster: ReactNode }) {
  const { reduced, capability } = useHomeMotion();
  const { config, peak, label } = useSummit();
  const ref = useRef<HTMLDivElement>(null);
  const props = useMemo<StudioObjectViewProps>(
    () => ({
      config,
      texts: { peak },
      view: "orbit",
      cutZ: null,
      exploded: false,
      autoRotate: false,
    }),
    [config, peak],
  );
  useHomeView(ref, "studio-object", props, {
    enabled: !reduced && capability !== null && capability >= 1,
    clear: "tone",
    bakeWhenIdle: capability === 1,
  });

  return (
    <div
      ref={ref}
      data-stage-view="studio-object"
      {...{ [HOME_VIEW_ATTR]: "summit" }}
      className={styles.summitView}
    >
      <div className="s3d-poster absolute inset-0" aria-hidden="true">
        <div className={styles.summitPoster}>{poster}</div>
      </div>
      <p
        aria-live="polite"
        className={cx(
          "s3d-label ph-mask normal-case text-ink",
          styles.summitCaption,
        )}
      >
        {label}
      </p>
    </div>
  );
}
