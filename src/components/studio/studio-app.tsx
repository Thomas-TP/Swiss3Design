"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { MeasureStrip } from "@/components/ui/measure-strip";
import { Toast, useToast } from "@/components/ui/toast";
import { StudioEngine } from "@/gates/studio";
import { track } from "@/lib/analytics";
import { saveCreation } from "@/lib/studio/creations";
import { clampConfig } from "@/lib/studio/ranges";
import { computeStats } from "@/lib/studio/stats";
import { bandStatsFor } from "@/lib/studio/band-stats";
import {
  formatChfRange,
  formatDuration,
  formatGrams,
} from "@/lib/studio/format";
import {
  ISSUE_MESSAGE_KEYS,
  issueStrings,
  issueValues,
} from "@/lib/studio/guards";
import { PRICING } from "@/lib/studio/pricing-params";
import {
  surpriseBorne,
  surpriseCartouche,
  surpriseLavaux,
  surpriseRelief,
} from "@/lib/studio/presets";
import { configFragment, machineLine } from "@/lib/studio/url-state";
import type { TextField } from "@/lib/studio/text/fields";
import type {
  Printability,
  StudioConfig,
  StudioObjectId,
} from "@/lib/studio/types";
import { listCreations } from "@/lib/studio/creations";
import { missingText, textsForObject } from "./objects";
import { SendDrawerHost, createOpenState } from "./send-drawer";
import type { StudioLocale } from "./scene-props";
import { ScenePanel } from "./scene-panel";
import { AltimetricBar, type Ctl } from "./studio-controls";
import { trackConfigured } from "./studio-events";
import {
  SectionTabs,
  StudioSections,
  sectionsFor,
  type SectionId,
} from "./studio-sections";
import { StudioToolbar } from "./studio-toolbar";
import {
  liveSummary,
  measureItems,
  objectName,
  summaryHasText,
  type SummaryInput,
  type Translate,
} from "./summary";
import { displayTexts, exampleTexts, hasTypedText } from "./texts";
import { makeThumbnail } from "./thumbnail";
import { useDebounced } from "./use-debounced";
import { useStudioDoc } from "./use-studio-doc";

// Le Studio d'un objet (brief « Strates », §6.7) : l'état (historique, URL,
// textes), les chiffres (une seule fonction pure, la même en SSR et ici), la
// scène, les sections de réglage, la fiche, le tiroir d'envoi et la barre
// d'action de mobile.
//
// SSR et sans JavaScript : tout le HTML est rendu par le serveur dans un
// formulaire GET (contrôles natifs, nommés par les clés courtes de l'URL),
// complet jusqu'au devis. `data-js` est posé sur la racine après l'hydratation :
// il révèle ce qui n'a de sens qu'avec JavaScript (curseurs, barre d'outils,
// onglets, bouton d'envoi) et masque ce qui n'en a que sans (« Appliquer »,
// lien vers le formulaire de devis).
//
// Aucun texte saisi hors de ce composant et de ses enfants : ni dans l'URL ni
// dans un événement (§4.10). Les textes AFFICHÉS (saisis, ou exemples tant que
// rien n'est saisi) ne servent qu'à l'aperçu ; l'envoi lit les textes SAISIS.

const SUMMARY_DELAY_MS = 1000;

function newSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0];
}

function surprise(object: StudioObjectId, seed: number): StudioConfig {
  switch (object) {
    case "lavaux":
      return surpriseLavaux(seed);
    case "cartouche":
      return surpriseCartouche(seed);
    case "relief":
      return surpriseRelief(seed);
    case "borne":
      return surpriseBorne(seed);
  }
}

type Issue = Extract<Printability, { issues: unknown }>["issues"][number];

export interface StudioAppProps {
  object: StudioObjectId;
  /** Réglages de départ : valeurs par défaut ou paramètres GET du formulaire sans JavaScript. */
  initialConfig: StudioConfig;
  /** Les paramètres GET étaient illisibles : valeurs par défaut, à signaler. */
  initialInvalid?: boolean;
  /** Chemin (avec la langue) de la page : action du formulaire GET. */
  action: string;
  /** Fil d'Ariane (bureau), rendu par le serveur. */
  breadcrumb: ReactNode;
  /** h1 et description, rendus par le serveur : en tête de la colonne de réglage. */
  intro: ReactNode;
}

export function StudioApp({
  object,
  initialConfig,
  initialInvalid = false,
  action,
  breadcrumb,
  intro,
}: StudioAppProps) {
  const t = useTranslations("studio") as unknown as Translate;
  const core = useTranslations("studioCore") as unknown as Translate;
  const locale = useLocale() as StudioLocale;
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const doc = useStudioDoc(object, initialConfig, initialInvalid);
  const { config, texts, dispatch } = doc;
  const toast = useToast();

  const [reprint, setReprint] = useState(0);
  const [tab, setTab] = useState<SectionId>("shape");
  // Le tiroir d'envoi s'ouvre sans redessiner ce composant (voir send-drawer.tsx).
  const sendState = useMemo(() => createOpenState(), []);

  // ── Chiffres : une fonction pure, identique côté serveur ──────────────────
  const examples = useMemo(() => exampleTexts(object, core), [object, core]);
  const shown = useMemo(
    () => displayTexts(object, texts, examples),
    [object, texts, examples],
  );
  const stats = useMemo(
    () => computeStats(config, shown, PRICING, locale),
    [config, shown, locale],
  );
  const bands = useMemo(
    () => bandStatsFor(config, shown, PRICING, locale),
    [config, shown, locale],
  );
  const sections = useMemo(() => sectionsFor(object), [object]);

  const summaryInput: SummaryInput = useMemo(
    () => ({ config, texts: shown, stats, bands, locale, t, core }),
    [config, shown, stats, bands, locale, t, core],
  );

  // ── Après l'hydratation : ce qui n'existe qu'avec JavaScript ──────────────
  useEffect(() => {
    rootRef.current?.setAttribute("data-js", "");
  }, []);

  // ── Gestes ────────────────────────────────────────────────────────────────
  const change = useCallback<Ctl["change"]>(
    (next, control, options = {}) => {
      dispatch({
        type: "set",
        patch: { config: clampConfig(next) },
        commit: options.commit ?? false,
      });
      if (options.reprint) setReprint((n) => n + 1);
      trackConfigured(object, control);
    },
    [dispatch, object],
  );
  const commit = useCallback(() => dispatch({ type: "commit" }), [dispatch]);
  const setText = useCallback(
    (field: TextField, value: string) => {
      dispatch({ type: "texts", patch: { [field]: value } });
      trackConfigured(object, "text");
    },
    [dispatch, object],
  );

  const ctl: Ctl = {
    object,
    config,
    texts,
    examples,
    stats,
    bands,
    locale,
    t,
    core,
    uid,
    change,
    commit,
    setText,
    newSeed,
  };

  const issueText = useCallback(
    (issue: Issue) =>
      core(ISSUE_MESSAGE_KEYS[issue.code], {
        ...issueValues(issue),
        ...issueStrings(issue),
      }),
    [core],
  );

  const fix = useCallback(
    (issue: Issue) => {
      if (!issue.fix) return;
      change({ ...config, ...issue.fix } as StudioConfig, "fix", {
        commit: true,
        reprint: true,
      });
    },
    [change, config],
  );

  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  // Ctrl/⌘ + Z, Maj + Ctrl/⌘ + Z : sauf dans un champ de texte, où le
  // navigateur annule la frappe (c'est le geste attendu).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("textarea, select") ||
          target.closest(
            "input:not([type=range]):not([type=radio]):not([type=checkbox]):not([type=button])",
          ))
      )
        return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const onSurprise = useCallback(() => {
    change(surprise(object, newSeed()), "surprise", {
      commit: true,
      reprint: true,
    });
  }, [change, object]);

  /** Lien de configuration (chemin + fragment) : exact même s'il vient d'être changé. */
  const link = useCallback(
    () => `${window.location.pathname}${configFragment(config)}`,
    [config],
  );

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}${link()}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, cadre) : sélection manuelle.
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch {
        // Rien de plus à tenter : le lien reste dans la barre d'adresse.
      }
      area.remove();
    }
    toast.show(t("toast.linkCopied"));
    track("Studio Link Copied", { object });
  }, [link, object, t, toast]);

  const keep = useCallback(async () => {
    const thumbnail = await makeThumbnail({
      config,
      texts: shown,
      locale,
      size: 256,
    });
    const saved = saveCreation({
      object,
      fragment: configFragment(config),
      ...(hasTypedText(object, texts) ? { texts } : {}),
      thumbnail,
      label: `${objectName(summaryInput)} · ${core("units.dimensions", {
        width: stats.widthMm,
        depth: stats.depthMm,
        height: stats.heightMm,
      })}`,
    });
    toast.show(saved ? t("toast.kept") : t("toast.keepFailed"));
    if (saved) track("Studio Saved", { object });
  }, [
    config,
    shown,
    locale,
    object,
    texts,
    summaryInput,
    core,
    stats,
    t,
    toast,
  ]);

  // Un lien partagé illisible : réglages de départ et un mot (§6.7 « États »).
  useEffect(() => {
    if (doc.ready && doc.invalidLink) toast.show(t("toast.invalidLink"));
    // Une seule fois, à la première lecture de l'URL.
    // oxlint-disable-next-line exhaustive-deps
  }, [doc.ready, doc.invalidLink]);

  // Retrouve les textes d'une création gardée quand on la rouvre par son lien.
  useEffect(() => {
    if (!doc.ready || hasTypedText(object, texts)) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const match = listCreations().find(
      (c) =>
        c.object === object && c.texts && c.fragment.replace(/^#/, "") === hash,
    );
    if (match?.texts) dispatch({ type: "texts", patch: match.texts });
    // Une fois, quand l'URL est lue.
    // oxlint-disable-next-line exhaustive-deps
  }, [doc.ready]);

  // ── Envoi ─────────────────────────────────────────────────────────────────
  const issues = stats.printable.status === "ok" ? [] : stats.printable.issues;
  const nearVase = issues.find((issue) => issue.code === "near-vase-spirale");
  const missing = missingText(config, texts);
  const blocked = stats.printable.status === "error" || missing !== null;
  const reasonId = `${uid}-blocked`;
  const reason = nearVase
    ? issueText(nearVase)
    : stats.printable.status === "error"
      ? t("send.blocked")
      : missing !== null
        ? t("send.needText", { field: t(`ctl.text.${missing}`) })
        : null;

  // Les textes SAISIS partent, jamais les exemples (voir texts.ts).
  const sendInput: SummaryInput = useMemo(
    () => ({
      ...summaryInput,
      texts: textsForObject(object, texts),
    }),
    [summaryInput, object, texts],
  );

  // L'ouverture d'un <dialog> modal coûte deux recalculs de style de toute la
  // page (showModal, puis l'arrêt de Lenis) : mesurés à ~170 ms en CPU ×4, trop
  // pour un clic. Le clic rend donc la main tout de suite (requestAnimationFrame
  // passe avant la peinture, le setTimeout qui suit après) : l'INP du bouton se
  // mesure jusqu'à la prochaine image, le tiroir s'ouvre dans la suivante.
  const openSend = useCallback(() => {
    if (blocked) return;
    window.requestAnimationFrame(() => {
      window.setTimeout(() => sendState.set(true), 0);
    });
  }, [blocked, sendState]);

  // ── Résumé vivant (aria-live, 1 s) ────────────────────────────────────────
  const summary = liveSummary(summaryInput);
  const announced = useDebounced(summary, SUMMARY_DELAY_MS);

  const onGetSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    // Avec JavaScript, rien ne part : chaque réglage est déjà appliqué.
    if (rootRef.current?.hasAttribute("data-js")) event.preventDefault();
  }, []);

  const priceText = stats.estimate
    ? formatChfRange(stats.estimate.lowCents, stats.estimate.highCents, locale)
    : null;

  const sendButton = (
    <div className="flex flex-col items-start gap-3">
      {/* Sans JavaScript : le lien de devis. Avec : le bouton qui ouvre le tiroir. */}
      <ButtonLink
        href="/custom#demande"
        variant="primary"
        size="lg"
        className="group-data-[js]/studio:hidden"
      >
        {t("send.noscript")}
      </ButtonLink>
      {/* Le conteneur porte l'affichage conditionnel : le bouton a son propre
          `inline-flex`, que `hidden` ne battrait pas (même spécificité), et un
          bouton sans effet sans JavaScript serait trompeur. */}
      <div className="hidden group-data-[js]/studio:max-lg:hidden group-data-[js]/studio:block">
        <Button
          variant="primary"
          size="lg"
          disabled={blocked}
          onClick={openSend}
          aria-describedby={reason ? reasonId : undefined}
        >
          {t("send.cta")}
        </Button>
      </div>
      {reason ? (
        <p
          id={reasonId}
          className="max-w-[46ch] text-sm font-medium text-accent-text"
        >
          {reason}
        </p>
      ) : null}
      <p className="max-w-[52ch] text-sm text-soft">{t("send.estimateNote")}</p>
    </div>
  );

  const noscriptNote = (
    <div className="flex flex-col gap-3 group-data-[js]/studio:hidden">
      {/* Avec JavaScript, le même constat est un toast (§6.7 « États »). */}
      {initialInvalid ? (
        <output className="block text-sm font-medium text-accent-text">
          {t("toast.invalidLink")}
        </output>
      ) : null}
      <p className="text-sm text-soft">{t("send.noscriptNote")}</p>
      <details className="rounded-card border border-line p-3 text-sm">
        <summary className="cursor-pointer text-ink">
          {t("send.machineLine")}
        </summary>
        <pre className="s3d-num mt-3 whitespace-pre-wrap break-all text-xs text-soft">
          {machineLine(config)}
        </pre>
      </details>
    </div>
  );

  return (
    <div ref={rootRef} className="group/studio">
      {/* Formulaire « de l'interface » : les curseurs, puces et champs de texte
          qui ne font pas partie de la requête GET y sont rattachés (attribut form). */}
      <form id="studio-local" onSubmit={(event) => event.preventDefault()} />
      <StudioEngine locale={locale} preloadGlyphs={object !== "lavaux"} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 max-lg:hidden">
        {breadcrumb}
        <StudioToolbar
          canUndo={doc.canUndo}
          canRedo={doc.canRedo}
          onUndo={undo}
          onRedo={redo}
          onSurprise={onSurprise}
          onCopy={copyLink}
          onKeep={keep}
          labels={{
            undo: t("tools.undo"),
            redo: t("tools.redo"),
            surprise: t("tools.surprise"),
            copy: t("tools.copy"),
            keep: t("tools.keep"),
            group: t("tools.group"),
          }}
        />
      </div>

      <form
        method="get"
        action={action}
        onSubmit={onGetSubmit}
        className={cx(
          // Mobile : la scène en haut, les réglages défilent dessous, la barre d'action en bas.
          "max-lg:flex max-lg:h-[calc(100svh-8.5rem-env(safe-area-inset-bottom))] max-lg:min-h-[28rem] max-lg:flex-col",
          "lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-gutter",
        )}
      >
        <div className="max-lg:shrink-0 lg:col-span-7">
          <div className="lg:sticky lg:top-[88px]">
            <ScenePanel
              object={object}
              config={config}
              texts={shown}
              locale={locale}
              stats={stats}
              bands={bands}
              reprint={reprint}
              t={t}
              core={core}
              className="h-[min(46svh,24rem)] min-h-56 w-full lg:aspect-square lg:h-auto lg:max-h-[calc(100svh-12.5rem)]"
              bandBar={
                config.object === "lavaux" || config.object === "relief" ? (
                  <AltimetricBar
                    ctl={ctl}
                    config={config}
                    orientation="vertical"
                    className="h-full"
                  />
                ) : undefined
              }
            />
            <MeasureStrip
              items={measureItems({ config, stats, locale, core, t })}
              label={t("measure.label")}
              className="mt-3 max-lg:hidden"
            />
          </div>
        </div>

        <div
          data-lenis-prevent=""
          className="max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:pb-6 max-lg:pt-4 lg:col-span-5"
        >
          <div className="flex flex-col gap-8">
            {intro}
            <div className="lg:hidden">
              <StudioToolbar
                canUndo={doc.canUndo}
                canRedo={doc.canRedo}
                onUndo={undo}
                onRedo={redo}
                onSurprise={onSurprise}
                onCopy={copyLink}
                onKeep={keep}
                labels={{
                  undo: t("tools.undo"),
                  redo: t("tools.redo"),
                  surprise: t("tools.surprise"),
                  copy: t("tools.copy"),
                  keep: t("tools.keep"),
                  group: t("tools.group"),
                }}
              />
            </div>
            <SectionTabs
              legend={t("sections.legend")}
              sections={sections}
              value={tab}
              onChange={setTab}
              labelOf={(section) => t(`sections.${section}`)}
            />
            <StudioSections
              ctl={ctl}
              sections={sections}
              tab={tab}
              titleOf={(section) => t(`sections.${section}`)}
              issueText={issueText}
              onFix={fix}
              actions={sendButton}
              noscriptNote={noscriptNote}
            />
            {/* Sans JavaScript : « Appliquer » envoie le formulaire GET (la page se recharge avec les réglages). */}
            <div className="group-data-[js]/studio:hidden">
              <Button type="submit" variant="secondary">
                {t("apply")}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Résumé vivant : le canvas est muet pour les lecteurs d'écran (§6.10). */}
      <p
        aria-live="polite"
        className={cx("sr-only", summaryHasText(config, shown) && "ph-mask")}
      >
        {announced}
      </p>

      {/* Barre d'action de mobile : remplace la BottomNav sur /studio/<objet>. */}
      <div
        className="fixed inset-x-0 bottom-0 z-[45] hidden border-t border-line bg-surface/90 backdrop-blur-lg group-data-[js]/studio:max-lg:block"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          viewTransitionName: "site-bottom-nav",
        }}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-[var(--spacing-margin)]">
          <p className="s3d-label ph-no-capture min-w-0 normal-case text-ink">
            {priceText ??
              `≈ ${formatGrams(stats.grams, locale)} · ≈ ${formatDuration(stats.minutes, locale)}`}
          </p>
          <Button
            variant="primary"
            disabled={blocked}
            onClick={openSend}
            aria-describedby={reason ? reasonId : undefined}
          >
            {t("send.cta")}
          </Button>
        </div>
      </div>

      <SendDrawerHost
        state={sendState}
        input={sendInput}
        object={object}
        locale={locale}
        link={link}
      />
      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
}
