"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  submitQuoteRequest,
  type QuoteFormState,
} from "@/app/[locale]/(site)/custom/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { withDot } from "@/components/ui/dot-title";
import { Field, fieldClass, fieldIds } from "@/components/ui/field";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import { useMotionBridge } from "@/lib/motion-bridge/store";
import {
  QUOTE_UPLOAD_MAX_BYTES,
  uploadQuoteFile,
} from "@/lib/quote-upload-client";
import type { StudioObjectId } from "@/lib/studio/types";
import {
  QUOTE_CONTACT_EMAIL,
  QUOTE_LIMITS,
  attemptSubmit,
  formatBytes,
  formatCount,
  formatPercent,
  submitSteps,
  uploadErrorKey,
  userMessageOf,
} from "./quote-logic";
import { QuoteFileField, useQuoteFile } from "./quote-file-field";
import { StudioAttachmentCard } from "./studio-attachment-card";
import { MeshEstimator } from "./mesh-estimator";
import {
  ProductViewer,
  ViewerCredits,
} from "@/components/catalog/product-viewer";
import type { ViewerModelFile } from "@/components/catalog/viewer-props";
import { selectableColorIds, useCustomStock } from "./quote-color-picker";
import { QuoteColors } from "./quote-colors";
import type { EstimateResult } from "@/lib/mesh-weight/client";
import { PaintStudio } from "@/components/paint/paint-studio-lazy";
import { printedRefs } from "@/components/paint/slots";
import type {
  ColorSetup,
  PaintNotice,
  PaintProject,
  PaintSourceFile,
} from "@/components/paint/types";
import {
  CUSTOM_MATERIAL,
  QUOTE_COLORS_MAX,
  QUOTE_QUANTITY_MAX,
} from "@/lib/filament/constants";

// Formulaire de demande de devis PARTAGÉ (brief « Strates », §7.10, §6.9) :
// la page /custom (variante « page », une fiche à filets) et le tiroir
// « Envoyer à l'atelier » du Studio (variante « drawer ») posent le même
// composant sur la même Server Action, submitQuoteRequest, inchangée (quota
// de 5 envois par 10 minutes, schéma zod, transaction quote_requests +
// status_events, e-mail de l'admin par l'outbox, jamais de redirect()).
//
// ── Contrat pour WP-STUDIO ─────────────────────────────────────────────────
//  • `source` / `object` : vont dans l'évènement « Quote Requested ».
//  • `prefill` : description, matière, couleurs, dimensions. Variante
//    « drawer » avec une description préremplie : les quatre champs sont
//    ENVOYÉS TELS QUELS, sans être affichés (le tiroir montre déjà le
//    récapitulatif) ; la description suit la prop à chaque rendu. Le Studio
//    y replie donc lui-même la quantité et la remarque que saisissent ses
//    `extraFields`, avant de la passer ici. Variante « page » : champs
//    visibles, préremplis, modifiables.
//  • `attachment` : `key` + `name` = fichier déjà envoyé ; `prepare` = envoi
//    paresseux, appelé à la soumission (le Studio y exporte le STL dans son
//    Worker puis appelle uploadQuoteFile) ; son résultat est gardé : un
//    « Réessayer » après une erreur de la Server Action ne relance ni
//    l'export ni l'envoi. `prepare` peut lever une QuoteUploadError (messages
//    429/413/415/400 prêts) ou toute erreur portant `userMessage: string`
//    (message déjà traduit, affiché tel quel). `summary` : carte « Studio
//    jointe » (vignette, lignes, et éventuellement « Modifier » / « Retirer »).
//    Sans `attachment`, la variante « page » propose son propre dépôt de fichier.
//  • `extraFields` : champs supplémentaires (quantité), rendus après l'e-mail.
//  • `successActions` : boutons du panneau de succès ; par défaut, la page
//    propose le Studio, la boutique et « Suivre ma demande » (session), le
//    tiroir la boutique seulement.
//  • `onSuccess` : appelé une fois, au passage en succès.
//
// L'envoi est piloté ici : avec JavaScript, onSubmit prépare le fichier,
// fabrique le FormData et appelle la Server Action dans une transition. Un
// champ n'est ainsi jamais effacé par React (le formulaire d'une <form action>
// se remet à zéro après l'action, même en cas d'erreur : le visiteur perdrait sa
// demande). Sans JavaScript, le <form action={formAction}> reste un
// formulaire natif que le serveur traite (amélioration progressive).
//
// L'action est appelée directement et non par `formAction` : une Server Action
// qui échoue au niveau réseau (connexion coupée, 5xx) LÈVE dans le rendu de
// `useActionState`, et l'exception remonterait jusqu'à error.tsx en emportant
// la page entière (/custom comprise) avec la saisie du visiteur. Ici l'échec
// est attrapé (attemptSubmit), le formulaire reste monté avec sa saisie et son
// fichier déjà envoyé, et affiche « L'envoi a échoué… » avec « Réessayer » :
// le second envoi ne repasse ni par l'export ni par le téléversement.

export interface QuotePrefill {
  description?: string;
  material?: string;
  colors?: string;
  dimensions?: string;
}

export interface QuoteUploadProgress {
  phase: "prepare" | "upload" | "submit";
  /** Ce qui est préparé ou envoyé : le fichier (défaut) ou le projet de couleurs. */
  subject?: "file" | "project";
  /** Octets envoyés et total (phase « upload »). */
  loaded?: number;
  total?: number;
  /** Nombre de triangles du fichier en préparation (phase « prepare »). */
  triangles?: number;
}

export interface QuoteAttachmentSummary {
  title: string;
  lines: string[];
  /** Note discrète sous la liste. */
  note?: string;
  thumbnail?: string;
  /** « Modifier dans le Studio » (ajout au contrat du brief : facultatif). */
  editHref?: string;
  /** « Retirer » (ajout au contrat du brief : facultatif). */
  onRemove?: () => void;
}

export interface QuoteAttachment {
  key?: string;
  name?: string; // déjà envoyé
  prepare?: (
    onProgress: (progress: QuoteUploadProgress) => void,
  ) => Promise<{ key: string; name: string }>; // envoi paresseux
  summary?: QuoteAttachmentSummary;
}

export interface QuoteRequestFormProps {
  source: "form" | "studio";
  object?: StudioObjectId;
  prefill?: QuotePrefill;
  attachment?: QuoteAttachment | null;
  variant?: "page" | "drawer";
  extraFields?: ReactNode; // ex. quantité (Studio)
  onSuccess?: () => void;
  /** Boutons du panneau de succès (ajout au contrat du brief : facultatif). */
  successActions?: ReactNode;
}

const INITIAL_STATE: QuoteFormState = { status: "idle" };

/** Lecture du fichier 3D dans le navigateur (poids estimé d'UNE pièce). */
type EstimateState =
  | { status: "idle" }
  | { status: "running" }
  | {
      status: "ok";
      grams: number;
      approximate: boolean;
      /** Boîte englobante en mm (largeur, profondeur, hauteur). */
      size: [number, number, number];
    }
  | {
      status: "error";
      reason: "unsupported" | "unreadable" | "timeout" | "empty" | "tiny";
      step: boolean;
    };

/** Côté du plateau (mm) : P1S 256 mm, K2 260 mm, on garde le plus petit. */
const PLATE_MM = 256;

/** Message (clé de `quote.file.*`) d'un fichier que l'on n'a pas pu lire : jamais d'estimation inventée. */
function estimateErrorKey(state: Extract<EstimateState, { status: "error" }>) {
  if (state.reason === "timeout") return "file.timeout";
  if (state.reason === "empty") return "file.empty";
  if (state.reason === "tiny") return "file.tooSmall";
  return state.step ? "file.stepFailed" : "file.estimateFailed";
}

/** « 120 × 80 × 45 mm » : au millimètre, au dixième sous 10 mm. */
export function formatSize(
  size: readonly [number, number, number],
  locale: string,
): string {
  const format = (mm: number) =>
    new Intl.NumberFormat(locale === "de" ? "de-CH" : locale, {
      maximumFractionDigits: mm < 10 ? 1 : 0,
    }).format(mm);
  return `${size.map(format).join(" × ")} mm`;
}

export function QuoteRequestForm({
  source,
  object,
  prefill,
  attachment,
  variant = "page",
  extraFields,
  onSuccess,
  successActions,
}: QuoteRequestFormProps) {
  const t = useTranslations("quote");
  const tPaint = useTranslations("paint");
  const tCustom = useTranslations("custom");
  const tShell = useTranslations("shell.cta");
  const locale = useLocale();
  const uid = useId().replace(/:/g, "");
  const { data: authSession } = useSession();
  // `formAction` ne sert qu'au formulaire natif (sans JavaScript, voir l'en-tête).
  const [nativeState, formAction, pending] = useActionState<
    QuoteFormState,
    FormData
  >(submitQuoteRequest, INITIAL_STATE);
  // Réponse de l'action pour un envoi piloté ici (JavaScript actif) : appelée
  // directement et non par `formAction`, pour qu'un échec réseau soit une valeur
  // et non une exception du rendu (voir attemptSubmit).
  const [sentState, setSentState] = useState<QuoteFormState | null>(null);
  const state = sentState ?? nativeState;
  const file = useQuoteFile();

  // E-mail : `null` tant que le visiteur n'a rien saisi. Le champ montre alors
  // celui de la session (dérivé au rendu, sans effet), et une saisie, même
  // vidée, l'emporte toujours.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [colors, setColors] = useState(prefill?.colors ?? "");
  const [dimensions, setDimensions] = useState(prefill?.dimensions ?? "");

  // Attente narrée : `since` est l'état de l'action au moment du clic. Tant
  // qu'il n'a pas changé (l'action n'a pas répondu), l'envoi est en cours ; dès
  // qu'elle répond, l'objet `state` est un autre et l'attente s'éteint d'elle-
  // même, sans effet ni remise à zéro à la main.
  const [activity, setActivity] = useState<{
    since: QuoteFormState;
    progress: QuoteUploadProgress;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const prepared = useRef<{ key: string; name: string } | null>(null);
  const sent = useRef<{ material: string; hasFile: boolean } | null>(null);
  const reported = useRef(false);
  const successPanel = useRef<HTMLDivElement>(null);

  const progress =
    activity && activity.since === state ? activity.progress : null;
  const busy = pending || progress !== null;

  const email = typedEmail ?? authSession?.user.email ?? "";

  // Succès : évènement (une fois), rappel de l'hôte, focus sur le panneau
  // (le formulaire vient de disparaître : le focus serait perdu).
  // oxlint-disable exhaustive-deps -- un seul envoi, au passage en succès ; session et rappel sont lus à cet instant
  useEffect(() => {
    if (state.status !== "success" || reported.current) return;
    reported.current = true;
    const submitted = sent.current;
    track("Quote Requested", {
      material: submitted?.material || undefined,
      has_file: submitted?.hasFile ?? false,
      signed_in: Boolean(authSession),
      source,
      ...(source === "studio" && object ? { object } : {}),
    });
    onSuccess?.();
    successPanel.current?.focus();
  }, [state]);
  // oxlint-enable exhaustive-deps

  // Variante « drawer » avec description préremplie : tout vient de `prefill`.
  const locked = variant === "drawer" && Boolean(prefill?.description?.trim());
  const showFileField = variant === "page" && !attachment;
  // Matière : le PLA, seule matière de l'atelier, pour une demande de /custom avec
  // fichier (le serveur l'impose aussi) ; sinon celle du préremplissage (Studio).
  const material = showFileField ? CUSTOM_MATERIAL : (prefill?.material ?? "");
  const uploading = file.state.status === "uploading";
  const hasError = !busy && (submitError !== null || state.status === "error");

  // ── Fichier 3D obligatoire, poids estimé, quantité, couleurs du stock ─────────
  // (variante « page » sans pièce jointe du Studio seulement)
  const [estimateTarget, setEstimateTarget] = useState<File | null>(null);
  const [estimate, setEstimate] = useState<EstimateState>({ status: "idle" });
  // Aperçu 3D du fichier (lu dans le navigateur, jamais envoyé pour cela) : les
  // triangles d'un STEP viennent de sa conversion ; un STL, OBJ ou 3MF est relu.
  const [preview, setPreview] = useState<{
    key: string;
    file: ViewerModelFile;
  } | null>(null);
  // Atelier 3D (peinture par zone, taille, orientation) : son dernier état, remonté
  // à chaque fermeture, et le projet déjà envoyé (un « Réessayer » ne le renvoie pas).
  const [project, setProject] = useState<PaintProject | null>(null);
  const [paintOpen, setPaintOpen] = useState(false);
  const [paintNotice, setPaintNotice] = useState<PaintNotice | null>(null);
  const sentProject = useRef<{
    version: string;
    key: string;
    name: string;
  } | null>(null);
  const stageAvailable = useMotionBridge(
    (s) => s.capability >= 1 && !s.contextLost,
  );
  const steps = submitSteps(
    Boolean(attachment?.prepare && !attachment.key) ||
      Boolean(showFileField && project?.matters),
  );
  const [quantityText, setQuantityText] = useState("1");
  // Couleurs : emplacements (filaments 1 à 4) et une ou plusieurs couleurs.
  // Rien n'est retiré en silence : une couleur dont le stock ne suffit plus
  // reste affichée, signalée, et bloque l'envoi jusqu'à ce qu'on la change.
  const [colorSetup, setColorSetup] = useState<ColorSetup>({
    refs: [],
    several: false,
  });
  const customStock = useCustomStock(showFileField);
  const quantity = Math.min(
    QUOTE_QUANTITY_MAX,
    Math.max(1, Number.parseInt(quantityText, 10) || 1),
  );
  // Poids d'UNE pièce : celui du fichier, au cube de l'échelle choisie dans l'atelier.
  const fileGrams = estimate.status === "ok" ? estimate.grams : null;
  const projectScale = project?.scale ?? 1;
  const gramsPerPiece =
    fileGrams === null
      ? null
      : Math.max(1, Math.round(fileGrams * projectScale ** 3));
  // Dimensions : calculées depuis le fichier (boîte englobante, ou celle de la
  // pièce tournée et mise à l'échelle dans l'atelier), jamais demandées.
  const measured =
    estimate.status !== "ok"
      ? null
      : project?.summary && project.matters
        ? formatSize(project.summary.size, locale)
        : formatSize(estimate.size, locale);
  const selectableIds = useMemo(
    () =>
      customStock.status === "ready"
        ? selectableColorIds(customStock.colors, gramsPerPiece, quantity)
        : new Set<string>(),
    [customStock, gramsPerPiece, quantity],
  );
  // Couleurs réellement imprimées (doublons réunis ; une seule en « une couleur »).
  const printed = useMemo(() => printedRefs(colorSetup), [colorSetup]);
  const shortRefs = printed.filter((id) => !selectableIds.has(id));
  const onEstimate = useCallback((result: EstimateResult) => {
    if (result.ok && result.positions)
      setPreview({
        key: `step-${result.positions.length}`,
        file: { format: "triangles", positions: result.positions },
      });
    setEstimate(
      result.ok
        ? {
            status: "ok",
            grams: result.grams,
            approximate: result.issue === "overlap",
            size: [
              result.stats.bbox[3] - result.stats.bbox[0],
              result.stats.bbox[4] - result.stats.bbox[1],
              result.stats.bbox[5] - result.stats.bbox[2],
            ],
          }
        : {
            status: "error",
            reason: result.reason,
            step: result.format === "step",
          },
    );
  }, []);
  function resetProject() {
    setProject(null);
    setPaintNotice(null);
    setPaintOpen(false);
    sentProject.current = null;
  }
  function pickFile(next: File) {
    file.select(next);
    setEstimateTarget(next);
    setEstimate({ status: "running" });
    setPreview(null);
    resetProject();
  }
  function clearFile() {
    file.clear();
    setEstimateTarget(null);
    setEstimate({ status: "idle" });
    setPreview(null);
    resetProject();
  }
  // Fichier lisible (poids estimé) : un STL, OBJ ou 3MF est relu pour l'aperçu.
  useEffect(() => {
    if (estimate.status !== "ok" || !estimateTarget) return;
    const format = /\.(stl|obj|3mf)$/i.exec(estimateTarget.name)?.[1];
    if (!format) return;
    let alive = true;
    const key = `${estimateTarget.name}-${estimateTarget.size}-${estimateTarget.lastModified}`;
    void estimateTarget.arrayBuffer().then(
      (buffer) => {
        if (alive)
          setPreview({
            key,
            file: {
              format: format.toLowerCase() as "stl" | "obj" | "3mf",
              buffer,
            },
          });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [estimate.status, estimateTarget]);
  // Couleurs effectivement placées sur la pièce dans l'atelier, et ajustements
  // (échelle, orientation) à rappeler sous le choix des couleurs.
  const placedColors = project?.matters
    ? project.summary.colors.filter((c) => c.share > 0).length
    : 0;
  const adjustments = project?.matters
    ? [
        project.scale !== 1
          ? tPaint("form.scale", {
              percent: formatCount(project.scale * 100, locale),
            })
          : null,
        project.summary.rotated ? tPaint("form.rotated") : null,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;
  // Teintes de l'aperçu : la première couleur choisie (ses 1 à 3 teintes), sinon
  // le blanc neutre du viewer.
  const previewTints = useMemo(() => {
    if (customStock.status !== "ready") return undefined;
    const first = customStock.colors.find((c) => c.id === printed[0]);
    return first?.hexes.length ? first.hexes : undefined;
  }, [customStock, printed]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    // JavaScript actif : c'est nous qui envoyons (voir l'en-tête du fichier).
    event.preventDefault();
    if (busy || uploading) return;
    const form = event.currentTarget;
    const since = state;
    setSubmitError(null);
    try {
      let key = attachment?.key;
      let name = attachment?.name;
      if (!key && file.state.status === "done") {
        key = file.state.key;
        name = file.state.name;
      }
      // Page /custom : un modèle 3D lisible est obligatoire, et son poids estimé
      // (sans quoi on n'invente rien) ; le serveur l'exige aussi.
      if (showFileField) {
        if (!key) {
          setSubmitError(t("file.required"));
          return;
        }
        if (estimate.status !== "ok") {
          setSubmitError(
            estimate.status === "error"
              ? t(estimateErrorKey(estimate))
              : t("file.estimating"),
          );
          return;
        }
        // Une couleur choisie ne suffit plus pour la pièce : le serveur la
        // refuserait, autant le dire avant d'envoyer.
        if (shortRefs.length > 0 && customStock.status === "ready") {
          setSubmitError(t("errors.color"));
          return;
        }
      }
      if (!key && attachment?.prepare) {
        const result =
          prepared.current ??
          (await attachment.prepare((next) =>
            setActivity({ since, progress: next }),
          ));
        prepared.current = result;
        key = result.key;
        name = result.name;
      }

      // Projet de couleurs de l'atelier 3D : le 3MF peint (prêt pour Bambu
      // Studio), écrit dans le navigateur puis envoyé comme le fichier.
      let colorProject: { key: string; name: string } | null = null;
      if (showFileField && project?.matters) {
        const version = `${project.version}:${printed.join(",")}:${colorSetup.several}`;
        if (sentProject.current?.version === version)
          colorProject = sentProject.current;
        else {
          setActivity({
            since,
            progress: { phase: "prepare", subject: "project" },
          });
          const blob = await project.export3mf();
          if (blob.size > QUOTE_UPLOAD_MAX_BYTES) {
            setActivity(null);
            setSubmitError(tPaint("form.tooLarge"));
            return;
          }
          const base = (name ?? "piece").replace(/\.[^.]+$/, "").slice(0, 60);
          const uploaded = await uploadQuoteFile(
            blob,
            ({ loaded, total }) =>
              setActivity({
                since,
                progress: {
                  phase: "upload",
                  subject: "project",
                  loaded,
                  total,
                },
              }),
            { fileName: `${base}-couleurs.3mf` },
          );
          sentProject.current = {
            version,
            key: uploaded.key,
            name: uploaded.fileName,
          };
          colorProject = sentProject.current;
        }
      }

      const data = new FormData(form);
      // Champs techniques de React pour l'envoi natif : inutiles ici.
      for (const field of Array.from(data.keys()))
        if (field.startsWith("$ACTION")) data.delete(field);
      if (key) {
        data.set("fileKey", key);
        if (name) data.set("fileName", name);
      }
      if (colorProject && project) {
        data.set("colorProjectKey", colorProject.key);
        data.set("colorProjectName", colorProject.name);
        data.set("colorProject", JSON.stringify(project.summary));
      }
      sent.current = {
        material: String(data.get("material") ?? ""),
        hasFile: Boolean(key),
      };
      setActivity({ since, progress: { phase: "submit" } });
      startTransition(async () => {
        const outcome = await attemptSubmit(() =>
          submitQuoteRequest(since, data),
        );
        if (outcome.ok) {
          startTransition(() => setSentState(outcome.state));
          return;
        }
        // Connexion coupée ou réponse inattendue : le formulaire reste monté
        // (saisie et fichier déjà envoyé gardés), le visiteur peut réessayer.
        // Ni texte saisi ni adresse dans le journal : l'erreur du réseau seule.
        console.error("[quote] envoi interrompu", outcome.error);
        setActivity(null);
        setSubmitError(t("errors.network"));
      });
    } catch (error) {
      setActivity(null);
      setSubmitError(
        userMessageOf(error) ??
          t(`errors.${uploadErrorKey(error)}`, { email: QUOTE_CONTACT_EMAIL }),
      );
    }
  }

  if (state.status === "success") {
    return (
      <div
        ref={successPanel}
        tabIndex={-1}
        // scroll-mt-24 : le focus amène le panneau sous l'en-tête fixe, pas derrière.
        className="scroll-mt-24 rounded-card border border-emerald-500/30 bg-emerald-500/10 p-6 outline-none sm:p-8"
      >
        <CheckCircle2
          size={28}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-emerald-600"
        />
        <p className="mt-4 font-display text-title text-ink">
          {withDot(t("success.title"))}
        </p>
        <p className="mt-2 max-w-[65ch] text-ink">
          {t(source === "studio" ? "success.studio" : "success.form")}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          {successActions ?? (
            <>
              {variant === "page" ? (
                <ButtonLink href="/studio" variant="secondary">
                  {tShell("studio")}
                </ButtonLink>
              ) : null}
              <ButtonLink href="/shop" variant="text">
                {tShell("shop")}
              </ButtonLink>
              {variant === "page" && authSession ? (
                <ButtonLink href="/account/quotes" variant="text">
                  {t("success.account")}
                </ButtonLink>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  const ids = {
    description: `${uid}-description`,
    colors: `${uid}-colors`,
    dimensions: `${uid}-dimensions`,
    email: `${uid}-email`,
    file: `${uid}-file`,
    quantity: `${uid}-quantity`,
  };
  const page = variant === "page";
  // Page : le fond est posé section par section (et non sur la carte) pour que
  // la bande de l'aperçu 3D reste transparente : la scène est peinte par le
  // canvas du Stage, DERRIÈRE la page, un fond au-dessus la cacherait.
  const sectionClass = page ? "bg-surface px-5 py-6 sm:px-8" : "";
  const legendClass =
    "s3d-label float-left mb-5 w-full text-soft [&+*]:clear-both";

  // Numéro de section : 01 fichier (si présent), puis projet, puis contact.
  const sectionNumbers = {
    file: "01",
    colors: "02",
    project: showFileField ? "03" : "01",
    contact: showFileField ? "04" : "02",
  };

  const narration = narrate(progress);
  const submitLabel = busy
    ? tCustom("submitting")
    : hasError
      ? t("retry")
      : tCustom("submit");

  function narrate(current: QuoteUploadProgress | null): {
    visible: string;
    announce: string;
  } | null {
    if (!current || steps === 1) return null;
    if (current.subject === "project" && current.phase === "prepare")
      return {
        announce: tPaint("form.preparing"),
        visible: tPaint("form.preparing"),
      };
    if (current.subject === "project" && current.phase === "upload")
      return {
        announce: tPaint("form.uploading"),
        visible:
          current.loaded === undefined || !current.total
            ? tPaint("form.uploading")
            : tPaint("form.uploadingDetail", {
                size: formatBytes(current.total, locale),
                percent: formatPercent(current.loaded / current.total, locale),
              }),
      };
    if (current.phase === "prepare")
      return {
        announce: t("progress.prepare"),
        visible:
          current.triangles === undefined
            ? t("progress.prepare")
            : t("progress.prepareTriangles", {
                triangles: formatCount(current.triangles, locale),
              }),
      };
    if (current.phase === "upload")
      return {
        announce: t("progress.upload"),
        visible:
          current.loaded === undefined || !current.total
            ? t("progress.upload")
            : t("progress.uploadDetail", {
                size: formatBytes(current.total, locale),
                percent: formatPercent(current.loaded / current.total, locale),
              }),
      };
    return {
      announce: t("progress.submit"),
      visible: t("progress.submit"),
    };
  }

  const body = (
    <>
      {attachment?.summary ? (
        <div className={page ? "bg-surface px-5 pt-6 sm:px-8" : undefined}>
          <StudioAttachmentCard {...attachment.summary} />
        </div>
      ) : null}

      {showFileField ? (
        <fieldset className={cx("m-0 min-w-0 border-0", sectionClass)}>
          <legend className={legendClass}>
            <span className="text-ink">{sectionNumbers.file}</span>
            <span aria-hidden="true" className="mx-2 text-iso-index">
              ·
            </span>
            {t("sheet.file")}
          </legend>
          <div>
            <div className="min-w-0">
              <QuoteFileField
                id={ids.file}
                state={file.state}
                onSelect={pickFile}
                onClear={clearFile}
              />
              {/* Lecture du fichier dans le navigateur : poids estimé d'UNE pièce. */}
              {estimateTarget && estimate.status === "running" ? (
                <MeshEstimator
                  key={`${estimateTarget.name}-${estimateTarget.size}-${estimateTarget.lastModified}`}
                  file={estimateTarget}
                  onResult={onEstimate}
                />
              ) : null}
              <div className="mt-3 min-h-5 text-sm" aria-live="polite">
                {estimate.status === "running" ? (
                  <p className="text-soft">{t("file.estimating")}</p>
                ) : estimate.status === "ok" ? (
                  <p className="ph-no-capture text-ink">
                    {t("file.size", { size: measured ?? "" })}
                    {" · "}
                    {t("file.estimate", {
                      grams: `${formatCount(estimate.grams, locale)} g`,
                    })}
                    {estimate.approximate ? (
                      <span className="text-soft">
                        {" "}
                        · {t("file.estimateApprox")}
                      </span>
                    ) : null}
                  </p>
                ) : estimate.status === "error" ? (
                  <p role="alert" className="font-medium text-accent-text">
                    {t(estimateErrorKey(estimate))}
                  </p>
                ) : (
                  <p className="text-soft">{t("file.required")}</p>
                )}
              </div>
            </div>
          </div>
        </fieldset>
      ) : null}

      {showFileField && preview ? (
        // Aperçu : la pièce du visiteur, à l'échelle, posée sur la même table que
        // les articles de la boutique, dans la couleur choisie, sur toute la
        // largeur du formulaire. Bande transparente (voir `sectionClass`).
        <figure className="m-0 border-t border-line">
          <div className="relative aspect-[4/3] sm:aspect-[16/10]">
            <ProductViewer
              key={preview.key}
              name={estimateTarget?.name ?? t("preview.title")}
              // La pièce peinte, tournée et mise à l'échelle dans l'atelier ;
              // sinon le fichier tel quel, dans la première couleur choisie.
              modelFile={project?.preview ?? preview.file}
              colors={previewTints}
              // Le visiteur vient de choisir son fichier : il regarde la vue.
              eager
            />
          </div>
          <figcaption className="border-t border-line bg-surface px-5 py-3 sm:px-8">
            <ViewerCredits
              caption={
                printed.length > 1 && !project?.preview
                  ? t("preview.captionFirstColor")
                  : t("preview.caption")
              }
            />
          </figcaption>
          {preview.file.format !== "painted" ? (
            <PaintStudio
              source={preview.file as PaintSourceFile}
              sourceKey={preview.key}
              fileName={estimateTarget?.name ?? ""}
              stock={
                customStock.status === "ready"
                  ? customStock.colors
                  : customStock.status === "error"
                    ? []
                    : null
              }
              selectable={selectableIds}
              setup={colorSetup}
              onSetupChange={setColorSetup}
              maxColors={QUOTE_COLORS_MAX}
              gramsPerPiece={fileGrams}
              plate={PLATE_MM}
              open={paintOpen}
              onClose={() => setPaintOpen(false)}
              onProject={setProject}
              onNotice={setPaintNotice}
            />
          ) : null}
        </figure>
      ) : null}

      {locked ? (
        <>
          {/* ph-no-capture : la description complète (avec les textes à
              imprimer d'un passage Studio) n'est affichée nulle part, mais
              l'attribut `value` d'un champ caché entre dans les enregistrements
              de visite : `maskAllInputs` ne couvre pas le type `hidden`, et
              `ph-mask` ne masque que les textes. Le bloc est retiré de
              l'enregistrement, quel que soit l'hôte du formulaire. */}
          <input
            type="hidden"
            name="description"
            value={prefill?.description}
            className="ph-no-capture"
          />
          <input
            type="hidden"
            name="material"
            value={prefill?.material ?? ""}
            className="ph-no-capture"
          />
          <input
            type="hidden"
            name="colors"
            value={prefill?.colors ?? ""}
            className="ph-no-capture"
          />
          <input
            type="hidden"
            name="dimensions"
            value={prefill?.dimensions ?? ""}
            className="ph-no-capture"
          />
        </>
      ) : (
        <>
          {showFileField ? (
            <fieldset
              className={cx(
                "m-0 min-w-0 border-0 border-t border-line",
                sectionClass,
              )}
            >
              <legend className={legendClass}>
                <span className="text-ink">{sectionNumbers.colors}</span>
                <span aria-hidden="true" className="mx-2 text-iso-index">
                  ·
                </span>
                {t("sheet.colors")}
              </legend>
              <QuoteColors
                stock={customStock}
                selectable={selectableIds}
                setup={colorSetup}
                onChange={setColorSetup}
                max={QUOTE_COLORS_MAX}
                weighed={gramsPerPiece !== null}
                hasFile={estimateTarget !== null}
                shares={project?.slotShares ?? null}
                placed={placedColors}
                adjustments={adjustments}
                notice={paintNotice}
                canPlace={
                  Boolean(preview) &&
                  stageAvailable &&
                  paintNotice?.kind !== "error"
                }
                onPlace={() => setPaintOpen(true)}
              />
            </fieldset>
          ) : null}
          <fieldset
            className={cx(
              "m-0 min-w-0 border-0",
              sectionClass,
              showFileField && "border-t border-line",
            )}
          >
            <legend className={legendClass}>
              <span className="text-ink">{sectionNumbers.project}</span>
              <span aria-hidden="true" className="mx-2 text-iso-index">
                ·
              </span>
              {t("sheet.project")}
            </legend>
            <div className="space-y-5">
              <Field
                label={tCustom("description")}
                htmlFor={ids.description}
                hint={t("hints.description", {
                  min: QUOTE_LIMITS.descriptionMin,
                })}
                required
              >
                <textarea
                  id={ids.description}
                  name="description"
                  required
                  minLength={QUOTE_LIMITS.descriptionMin}
                  maxLength={QUOTE_LIMITS.description}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tCustom("descriptionPlaceholder")}
                  aria-describedby={fieldIds(ids.description).hint}
                  className={cx(fieldClass, "min-h-32 resize-y")}
                />
              </Field>

              {/* /custom avec fichier : matière (PLA, sans choix) et quantité côte à côte. */}
              <div
                className={cx("grid gap-5", showFileField && "sm:grid-cols-2")}
              >
                {showFileField ? (
                  <div className="flex flex-col gap-2">
                    <span className="s3d-label text-soft">
                      {t("fields.material")}
                    </span>
                    <p className="flex min-h-11 flex-wrap items-center gap-x-2 text-ink">
                      {CUSTOM_MATERIAL}
                      <span className="text-sm text-soft">
                        · {t("fields.materialOnly")}
                      </span>
                    </p>
                  </div>
                ) : null}
                <input type="hidden" name="material" value={material} />
                {showFileField ? (
                  <Field
                    label={t("fields.quantity")}
                    htmlFor={ids.quantity}
                    hint={t("hints.quantity", { max: QUOTE_QUANTITY_MAX })}
                  >
                    <input
                      id={ids.quantity}
                      name="quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={QUOTE_QUANTITY_MAX}
                      value={quantityText}
                      onChange={(e) => setQuantityText(e.target.value)}
                      aria-describedby={fieldIds(ids.quantity).hint}
                      className={fieldClass}
                    />
                  </Field>
                ) : (
                  <Field
                    label={
                      <>
                        {tCustom("colors")}{" "}
                        <span className="normal-case">
                          ({tCustom("optional")})
                        </span>
                      </>
                    }
                    htmlFor={ids.colors}
                  >
                    <input
                      id={ids.colors}
                      name="colors"
                      maxLength={QUOTE_LIMITS.colors}
                      value={colors}
                      onChange={(e) => setColors(e.target.value)}
                      placeholder={tCustom("colorsPlaceholder")}
                      className={fieldClass}
                    />
                  </Field>
                )}
              </div>

              {page ? (
                // Page : dimensions mesurées dans le fichier (ou venues du Studio),
                // jamais demandées au visiteur.
                <input
                  type="hidden"
                  name="dimensions"
                  value={measured ?? dimensions}
                />
              ) : (
                <Field
                  label={
                    <>
                      {tCustom("dimensions")}{" "}
                      <span className="normal-case">
                        ({tCustom("optional")})
                      </span>
                    </>
                  }
                  htmlFor={ids.dimensions}
                >
                  <input
                    id={ids.dimensions}
                    name="dimensions"
                    maxLength={QUOTE_LIMITS.dimensions}
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    placeholder={tCustom("dimensionsPlaceholder")}
                    className={fieldClass}
                  />
                </Field>
              )}
            </div>
          </fieldset>
        </>
      )}

      <fieldset
        className={cx(
          "m-0 min-w-0 border-0",
          sectionClass,
          page && "border-t border-line",
        )}
      >
        <legend className={legendClass}>
          <span className="text-ink">{sectionNumbers.contact}</span>
          <span aria-hidden="true" className="mx-2 text-iso-index">
            ·
          </span>
          {t("sheet.contact")}
        </legend>
        <div className="space-y-5">
          <Field
            label={tCustom("email")}
            htmlFor={ids.email}
            hint={t("hints.email")}
            required
          >
            <input
              id={ids.email}
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setTypedEmail(e.target.value)}
              aria-describedby={fieldIds(ids.email).hint}
              className={fieldClass}
            />
          </Field>
          {extraFields}
        </div>
      </fieldset>

      <div
        className={cx(
          "flex flex-col gap-3",
          page && "border-t border-line bg-paper px-5 py-6 sm:px-8",
        )}
      >
        {hasError ? (
          <p
            role="alert"
            className="rounded-field bg-accent/10 px-4 py-3 text-sm font-medium text-accent-text"
          >
            {submitError ??
              (state.status === "error" && state.reason === "file"
                ? t("file.required")
                : state.status === "error" && state.reason === "color"
                  ? t("errors.color")
                  : tCustom("error"))}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={busy || uploading || estimate.status === "running"}
            className="w-full sm:w-auto"
          >
            <Send size={16} strokeWidth={1.5} aria-hidden="true" />
            {submitLabel}
          </Button>
          {/* Détail visible (avec les pourcentages) ; le lecteur d'écran n'entend que la phase. */}
          <p aria-hidden="true" className="s3d-label min-h-4 text-soft">
            {narration?.visible}
          </p>
          <output className="sr-only">{narration?.announce}</output>
        </div>
      </div>
    </>
  );

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      aria-busy={busy}
      className={cx(
        page
          ? "overflow-hidden rounded-card border border-line"
          : "flex flex-col gap-6",
      )}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />
      {showFileField ? (
        <>
          <input
            type="hidden"
            name="colorRefs"
            value={JSON.stringify(printed)}
          />
          {gramsPerPiece !== null ? (
            <input type="hidden" name="estGrams" value={gramsPerPiece} />
          ) : null}
        </>
      ) : null}
      {body}
    </form>
  );
}
