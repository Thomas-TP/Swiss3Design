"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
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
import { Select } from "@/components/select";
import { Button, ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { withDot } from "@/components/ui/dot-title";
import { Field, fieldClass, fieldIds } from "@/components/ui/field";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import type { StudioObjectId } from "@/lib/studio/types";
import {
  QUOTE_CONTACT_EMAIL,
  QUOTE_LIMITS,
  formatBytes,
  formatCount,
  formatPercent,
  submitSteps,
  uploadErrorKey,
  userMessageOf,
} from "./quote-logic";
import { QuoteFileField, useQuoteFile } from "./quote-file-field";
import { StudioAttachmentCard } from "./studio-attachment-card";

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
// fabrique le FormData et appelle formAction dans une transition. Un champ
// n'est ainsi jamais effacé par React (le formulaire d'une <form action> se
// remet à zéro après l'action, même en cas d'erreur : le visiteur perdrait sa
// demande). Sans JavaScript, le <form action={formAction}> reste un
// formulaire natif que le serveur traite (amélioration progressive).

export interface QuotePrefill {
  description?: string;
  material?: string;
  colors?: string;
  dimensions?: string;
}

export interface QuoteUploadProgress {
  phase: "prepare" | "upload" | "submit";
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
  materials?: string[]; // absent → sélecteur masqué si prefill.material est fourni
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

export function QuoteRequestForm({
  materials,
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
  const tCustom = useTranslations("custom");
  const tShell = useTranslations("shell.cta");
  const locale = useLocale();
  const uid = useId().replace(/:/g, "");
  const { data: authSession } = useSession();
  const [state, formAction, pending] = useActionState<QuoteFormState, FormData>(
    submitQuoteRequest,
    INITIAL_STATE,
  );
  const file = useQuoteFile();

  const [email, setEmail] = useState("");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [material, setMaterial] = useState(prefill?.material ?? "");
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
  const steps = submitSteps(Boolean(attachment?.prepare && !attachment.key));

  // E-mail de la session : préremplit le champ, sans écraser une saisie.
  const sessionEmail = authSession?.user.email;
  useEffect(() => {
    if (sessionEmail) setEmail((current) => current || sessionEmail);
  }, [sessionEmail]);

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
  const locked =
    variant === "drawer" && Boolean(prefill?.description?.trim());
  const showMaterial = !locked && Boolean(materials && materials.length > 0);
  const showFileField = variant === "page" && !attachment;
  const uploading = file.state.status === "uploading";
  const hasError = !busy && (submitError !== null || state.status === "error");

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

      const data = new FormData(form);
      // Champs techniques de React pour l'envoi natif : inutiles ici.
      for (const field of Array.from(data.keys()))
        if (field.startsWith("$ACTION")) data.delete(field);
      if (key) {
        data.set("fileKey", key);
        if (name) data.set("fileName", name);
      }
      sent.current = {
        material: String(data.get("material") ?? ""),
        hasFile: Boolean(key),
      };
      setActivity({ since, progress: { phase: "submit" } });
      startTransition(() => formAction(data));
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
        className="rounded-card border border-emerald-500/30 bg-emerald-500/10 p-6 outline-none sm:p-8"
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
  };
  const page = variant === "page";
  const sectionClass = page ? "px-5 py-6 sm:px-8" : "";
  const legendClass =
    "s3d-label float-left mb-5 w-full text-soft [&+*]:clear-both";

  // Numéro de section : 01 projet, 02 fichier (si présent), puis contact.
  const sectionNumbers = {
    project: "01",
    file: "02",
    contact: showFileField ? "03" : "02",
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
        <div className={page ? "px-5 pt-6 sm:px-8" : undefined}>
          <StudioAttachmentCard {...attachment.summary} />
        </div>
      ) : null}

      {locked ? (
        <>
          <input type="hidden" name="description" value={prefill?.description} />
          <input type="hidden" name="material" value={prefill?.material ?? ""} />
          <input type="hidden" name="colors" value={prefill?.colors ?? ""} />
          <input
            type="hidden"
            name="dimensions"
            value={prefill?.dimensions ?? ""}
          />
        </>
      ) : (
        <fieldset className={cx("m-0 min-w-0 border-0", sectionClass)}>
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
              hint={t("hints.description", { min: QUOTE_LIMITS.descriptionMin })}
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

            <div className="grid gap-5 sm:grid-cols-2">
              {showMaterial ? (
                <div className="flex flex-col gap-2">
                  <span className="s3d-label text-soft">
                    {tCustom("material")}{" "}
                    <span className="normal-case">
                      ({tCustom("optional")})
                    </span>
                  </span>
                  <Select
                    name="material"
                    value={material}
                    onChange={setMaterial}
                    options={[
                      { value: "", label: tCustom("materialAny") },
                      ...(materials ?? []).map((m) => ({
                        value: m,
                        label: m,
                      })),
                    ]}
                    placeholder={tCustom("materialAny")}
                    ariaLabel={tCustom("material")}
                  />
                </div>
              ) : (
                // Pas de sélecteur : la matière vient du préremplissage (ou reste vide).
                <input type="hidden" name="material" value={material} />
              )}
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
            </div>

            <Field
              label={
                <>
                  {tCustom("dimensions")}{" "}
                  <span className="normal-case">({tCustom("optional")})</span>
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
          </div>
        </fieldset>
      )}

      {showFileField ? (
        <fieldset
          className={cx(
            "m-0 min-w-0 border-0",
            sectionClass,
            page && "border-t border-line",
          )}
        >
          <legend className={legendClass}>
            <span className="text-ink">{sectionNumbers.file}</span>
            <span aria-hidden="true" className="mx-2 text-iso-index">
              ·
            </span>
            {t("sheet.file")}{" "}
            <span className="normal-case">({tCustom("optional")})</span>
          </legend>
          <QuoteFileField
            id={ids.file}
            state={file.state}
            onSelect={file.select}
            onClear={file.clear}
          />
        </fieldset>
      ) : null}

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
              onChange={(e) => setEmail(e.target.value)}
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
            {submitError ?? tCustom("error")}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={busy || uploading}
            className="w-full sm:w-auto"
          >
            <Send size={16} strokeWidth={1.5} aria-hidden="true" />
            {submitLabel}
          </Button>
          {/* Détail visible (avec les pourcentages) ; le lecteur d'écran n'entend que la phase. */}
          <p aria-hidden="true" className="s3d-label min-h-4 text-soft">
            {narration?.visible}
          </p>
          <p role="status" className="sr-only">
            {narration?.announce}
          </p>
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
          ? "rounded-card border border-line bg-surface"
          : "flex flex-col gap-6",
      )}
    >
      <input type="hidden" name="locale" value={locale} />
      {body}
    </form>
  );
}
