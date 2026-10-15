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
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { MeasureStrip } from "@/components/ui/measure-strip";
import { Toast, useToast } from "@/components/ui/toast";
import { StudioEngine } from "@/gates/studio";
import { studioProductProperties, track } from "@/lib/analytics";
import { useCart } from "@/lib/cart";
import { formatChf } from "@/lib/format";
import { saveCreation } from "@/lib/studio/creations";
import { clampConfig } from "@/lib/studio/ranges";
import { computeStats } from "@/lib/studio/stats";
import { bandStatsFor } from "@/lib/studio/band-stats";
import { makeStockView } from "@/lib/studio/stock-view";
import {
  ISSUE_MESSAGE_KEYS,
  issueStrings,
  issueValues,
} from "@/lib/studio/guards";
import { buildStudioCartLine } from "@/lib/studio/cart-line";
import { STUDIO_QTY_MAX, studioUnitCents } from "@/lib/studio/price";
import { studioPrice } from "@/lib/studio/price-figures";
import { PRINT } from "@/lib/studio/print-params";
import {
  surpriseBorne,
  surpriseCartouche,
  surpriseLavaux,
  surpriseMontagne,
} from "@/lib/studio/presets";
import { configFragment, machineLine } from "@/lib/studio/url-state";
import type { TextField } from "@/lib/studio/text/fields";
import type {
  Printability,
  StudioConfig,
  StudioObjectId,
} from "@/lib/studio/types";
import { listCreations } from "@/lib/studio/creations";
import { BuyBox } from "./buy-box";
import {
  FilamentStockProvider,
  useFilamentCapacity,
} from "./use-filament-stock";
import {
  clearEditIntent,
  readEditIntent,
  type EditIntent,
} from "./edit-intent";
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
    case "montagne":
      return surpriseMontagne(seed);
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

  const cart = useCart();
  const [reprint, setReprint] = useState(0);
  // Achat : quantité de la ligne, ligne du panier en cours de modification et
  // dernier geste réussi (annonce « Ajouté au panier »).
  const [quantity, setQuantity] = useState(1);
  const [edit, setEdit] = useState<EditIntent | null>(null);
  const [done, setDone] = useState<"added" | "updated" | null>(null);
  const [tab, setTab] = useState<SectionId>("shape");
  // Mobile : l'aperçu réduit en bandeau pour laisser la place aux réglages.
  const [compact, setCompact] = useState(false);
  // Le tiroir d'envoi s'ouvre sans redessiner ce composant (voir send-drawer.tsx).
  const sendState = useMemo(() => createOpenState(), []);

  // ── Chiffres : une fonction pure, identique côté serveur ──────────────────
  const examples = useMemo(() => exampleTexts(object, core), [object, core]);
  const shown = useMemo(
    () => displayTexts(object, texts, examples),
    [object, texts, examples],
  );
  const stats = useMemo(
    () => computeStats(config, shown, PRINT, locale),
    [config, shown, locale],
  );
  const bands = useMemo(
    () => bandStatsFor(config, shown, PRINT, locale),
    [config, shown, locale],
  );
  // Stock de filament : les couleurs que la pièce et la quantité permettent
  // (capacité lue après l'hydratation ; sans elle, rien n'est grisé).
  const capacity = useFilamentCapacity();
  const stockView = useMemo(
    () => makeStockView(capacity, bands, config, quantity),
    [capacity, bands, config, quantity],
  );
  // Prix ferme, livraison comprise : `studioPrice` (price-figures.ts), la même
  // fonction que le serveur refait au paiement, en langue canonique pour la
  // Montagne (l'étiquette d'altitude change les grammes d'une langue à l'autre).
  const price = useMemo(
    () => studioPrice(config, shown, quantity, { locale, stats }),
    [config, shown, quantity, locale, stats],
  );
  // Prix d'UNE pièce, pour la ligne « Prix » de la fiche (indépendante de la quantité).
  const singleCents = useMemo(
    () =>
      studioUnitCents(
        config.object,
        { grams: price.stats.grams, changes: price.stats.changes },
        1,
      ),
    [config.object, price.stats],
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

  // Mémorisé : un rendu qui ne change ni la configuration ni les textes (la fin
  // d'un geste ne touche que l'historique) garde les mêmes contrôles, qui ne se
  // redessinent pas (StudioSections et ScenePanel sont mémorisés).
  const ctl: Ctl = useMemo(
    () => ({
      object,
      config,
      texts,
      examples,
      stats,
      singleCents,
      bands,
      locale,
      t,
      core,
      uid,
      change,
      commit,
      setText,
      newSeed,
    }),
    [
      object,
      config,
      texts,
      examples,
      stats,
      singleCents,
      bands,
      locale,
      t,
      core,
      uid,
      change,
      commit,
      setText,
    ],
  );

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

  // Modification d'une ligne du panier (« Modifier dans le Studio ») : la
  // configuration arrive par le fragment, les textes par la session, la quantité
  // et l'identité de la ligne par l'intention (edit-intent.ts).
  // oxlint-disable set-state-in-effect -- lecture de sessionStorage, que le serveur ne voit pas
  useEffect(() => {
    if (!doc.ready) return;
    const intent = readEditIntent(object);
    if (!intent) return;
    setEdit(intent);
    setQuantity(Math.min(STUDIO_QTY_MAX, Math.max(1, intent.quantity)));
  }, [doc.ready, object]);
  // oxlint-enable set-state-in-effect

  // Un geste sur la configuration, les textes ou la quantité efface l'annonce « Ajouté ».
  // oxlint-disable set-state-in-effect -- l'annonce suit le dernier geste
  useEffect(() => {
    setDone(null);
  }, [config, texts, quantity]);
  // oxlint-enable set-state-in-effect

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

  // Couleur épuisée : l'ajout au panier est bloqué (le devis reste possible), avec
  // le motif. Le serveur revérifie toujours au paiement (409 out_of_stock).
  const stockShort = stockView.short;
  const addBlocked = blocked || stockShort.size > 0;
  const addReason =
    reason ??
    (stockShort.size > 0
      ? t("buy.stockShort", {
          count: stockShort.size,
          colors: [...stockShort]
            .map((id) => core(`filaments.${id}`))
            .join(", "),
        })
      : null);

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

  // La ligne du panier modifiée existe encore (sinon c'est un simple ajout).
  const editing = Boolean(
    edit && cart.studioItems.some((line) => line.id === edit.id),
  );
  const cancelEdit = useCallback(() => {
    clearEditIntent();
    setEdit(null);
  }, []);

  // « Ajouter au panier » : les textes SAISIS (jamais les exemples) et la
  // configuration partent dans une ligne du panier du navigateur ; rien n'est
  // envoyé au serveur avant le paiement, qui revalide tout et refait le prix.
  const { addStudio, replaceStudio } = cart;
  const addToCart = useCallback(() => {
    if (addBlocked) return;
    const line = buildStudioCartLine({
      config,
      texts: textsForObject(object, texts),
      locale,
      quantity,
    });
    const updated = Boolean(edit && editing);
    if (updated && edit) replaceStudio(edit.id, line);
    else addStudio(line);
    if (updated) {
      clearEditIntent();
      setEdit(null);
    }
    // Jamais un texte saisi dans l'événement : l'objet, le prix, la quantité.
    track("Product Added", {
      ...studioProductProperties(line),
      source: "studio",
    });
    toast.show(updated ? t("buy.updated") : t("buy.added"));
    setDone(updated ? "updated" : "added");
  }, [
    addBlocked,
    config,
    texts,
    object,
    locale,
    quantity,
    edit,
    editing,
    addStudio,
    replaceStudio,
    toast,
    t,
  ]);

  // ── Résumé vivant (aria-live, 1 s) ────────────────────────────────────────
  const summary = liveSummary(summaryInput);
  const announced = useDebounced(summary, SUMMARY_DELAY_MS);

  const onGetSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    // Avec JavaScript, rien ne part : chaque réglage est déjà appliqué.
    if (rootRef.current?.hasAttribute("data-js")) event.preventDefault();
  }, []);

  // Mémorisé avec le bloc de réglage qui le porte : sans changement du prix, de
  // la quantité ou du blocage, il ne se redessine pas à chaque cran.
  const buyBox = useMemo(
    () => (
      <BuyBox
        t={t}
        locale={locale}
        unitCents={price.unitCents}
        quantity={quantity}
        onQuantity={setQuantity}
        blocked={addBlocked}
        reason={addReason}
        reasonId={reasonId}
        onAdd={addToCart}
        onQuote={openSend}
        editing={editing}
        onCancelEdit={cancelEdit}
        done={done}
      />
    ),
    [
      t,
      locale,
      price.unitCents,
      quantity,
      addBlocked,
      addReason,
      reasonId,
      addToCart,
      openSend,
      editing,
      cancelEdit,
      done,
    ],
  );

  const noscriptNote = useMemo(
    () => (
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
    ),
    [initialInvalid, config, t],
  );

  // Les rappels et éléments passés aux enfants mémorisés : stables d'un rendu à
  // l'autre tant que leur contenu ne change pas.
  const sectionLabel = useCallback(
    (section: SectionId) => t(`sections.${section}`),
    [t],
  );
  const bandBar = useMemo(
    () =>
      config.object === "lavaux" || config.object === "montagne" ? (
        <AltimetricBar
          ctl={ctl}
          config={config}
          orientation="vertical"
          className="h-full"
        />
      ) : undefined,
    [ctl, config],
  );

  return (
    <FilamentStockProvider value={stockView}>
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
            // Mobile : un écran d'application. L'aperçu occupe 40 % de la
            // hauteur (un bandeau de 8 rem une fois réduit), les réglages
            // défilent dans le reste, la barre d'action est dessous. La hauteur
            // retranche l'en-tête (65 px), l'air au-dessus du formulaire (0,5 rem)
            // et la barre (3,5 rem + son filet + la zone sûre).
            "max-lg:flex max-lg:h-[calc(100svh-4.0625rem-0.5rem-3.5625rem-env(safe-area-inset-bottom))] max-lg:min-h-[26rem] max-lg:flex-col",
            "lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-gutter",
          )}
        >
          {/* Bureau : la colonne s'étire sur toute la hauteur des réglages (sans
            quoi elle n'a pas la place de coller), et l'aperçu qu'elle porte reste
            sous l'en-tête pendant qu'on fait défiler les réglages. */}
          <div
            className={cx(
              "max-lg:flex max-lg:shrink-0 max-lg:flex-col lg:col-span-7 lg:self-stretch",
              compact ? "max-lg:h-32" : "max-lg:h-[40%]",
            )}
          >
            <div className="max-lg:min-h-0 max-lg:flex-1 lg:sticky lg:top-[88px]">
              <ScenePanel
                object={object}
                config={config}
                texts={shown}
                locale={locale}
                stats={stats}
                bands={bands}
                reprint={reprint}
                compact={compact}
                onCompactChange={setCompact}
                t={t}
                core={core}
                className="w-full max-lg:h-full lg:aspect-square lg:max-h-[calc(100svh-14rem)]"
                bandBar={bandBar}
              />
              <MeasureStrip
                items={measureItems({
                  config,
                  stats,
                  locale,
                  core,
                  t,
                  price: { unitCents: price.unitCents, quantity },
                })}
                label={t("measure.label")}
                className="mt-3 max-lg:hidden"
              />
            </div>
          </div>

          <div
            data-lenis-prevent=""
            className="max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:pb-6 max-lg:pt-3 lg:col-span-5"
          >
            <div className="flex flex-col gap-8 max-lg:gap-3">
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
                labelOf={sectionLabel}
              />
              <StudioSections
                ctl={ctl}
                sections={sections}
                tab={tab}
                titleOf={sectionLabel}
                issueText={issueText}
                onFix={fix}
                actions={buyBox}
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
          <div className="flex h-14 items-center justify-between gap-3 px-[var(--spacing-margin)]">
            <p className="s3d-label ph-no-capture min-w-0 normal-case text-ink">
              {formatChf(price.unitCents * quantity, locale)}
              {quantity > 1 ? ` · ×${quantity}` : ""}
            </p>
            <Button
              variant="primary"
              disabled={addBlocked}
              onClick={addToCart}
              aria-describedby={addReason ? reasonId : undefined}
            >
              {editing ? t("buy.update") : t("buy.cta")}
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
    </FilamentStockProvider>
  );
}
