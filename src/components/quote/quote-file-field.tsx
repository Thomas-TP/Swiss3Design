"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { CheckCircle2, Paperclip, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import {
  QUOTE_UPLOAD_ACCEPT,
  isQuoteUploadError,
  uploadQuoteFile,
  type QuoteUploadErrorCode,
} from "@/lib/quote-upload-client";
import {
  QUOTE_CONTACT_EMAIL,
  formatBytes,
  formatPercent,
} from "./quote-logic";

// Champ « fichier 3D » du formulaire de devis (brief « Strates », §7.10 :
// « zone de dépôt plus visible »). Le fichier part à la sélection, pas à
// l'envoi du formulaire : quand le visiteur écrit sa demande, la pièce est
// déjà chez nous, et un échec (quota, format, taille) se voit tout de suite.
// Sans JavaScript, ce champ n'a pas de sens (rien ne le poste) : le <noscript>
// le dit et renvoie vers l'adresse de l'atelier.

export type QuoteFileState =
  | { status: "idle" }
  | { status: "uploading"; name: string; loaded: number; total: number }
  | { status: "done"; key: string; name: string; bytes: number }
  | { status: "error"; code: QuoteUploadErrorCode };

/** État et gestes du fichier : sélection (envoi immédiat), retrait, annulation. */
export function useQuoteFile() {
  const [state, setState] = useState<QuoteFileState>({ status: "idle" });
  // Envoi en cours : un nouveau fichier, le retrait ou le démontage l'annulent,
  // et la réponse d'un envoi périmé n'écrase jamais l'état courant.
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  const select = useCallback(async (file: File) => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    const live = () => current.current === controller;
    setState({
      status: "uploading",
      name: file.name,
      loaded: 0,
      total: file.size,
    });
    try {
      const result = await uploadQuoteFile(
        file,
        (progress) => {
          if (live())
            setState({ status: "uploading", name: file.name, ...progress });
        },
        { signal: controller.signal },
      );
      if (live())
        setState({
          status: "done",
          key: result.key,
          name: result.fileName,
          bytes: file.size,
        });
    } catch (error) {
      if (!live()) return;
      setState({
        status: "error",
        code: isQuoteUploadError(error) ? error.code : "network",
      });
    }
  }, []);

  const clear = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, select, clear };
}

export function QuoteFileField({
  id,
  state,
  onSelect,
  onClear,
}: {
  /** Identifiant du champ natif (le libellé du fieldset le désigne). */
  id: string;
  state: QuoteFileState;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const t = useTranslations("quote");
  const tCustom = useTranslations("custom");
  const locale = useLocale();
  const [over, setOver] = useState(false);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Vidé aussitôt : choisir deux fois le même fichier redéclenche change.
    input.value = "";
    if (file) onSelect(file);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onSelect(file);
  }

  if (state.status === "uploading") {
    const fraction = state.total > 0 ? state.loaded / state.total : 0;
    const percent = formatPercent(fraction, locale);
    return (
      <div className="rounded-card border border-line bg-paper p-4">
        <div className="flex items-center gap-3">
          <Paperclip
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-soft"
          />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {state.name}
          </p>
          <button
            type="button"
            onClick={onClear}
            aria-label={t("file.remove", { name: state.name })}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-field text-soft transition-colors hover:bg-line/60 hover:text-accent-text"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div
          role="progressbar"
          aria-label={t("file.uploading", { percent })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          className="mt-2 h-1 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full bg-ink"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
        <p className="s3d-label mt-2 text-soft" aria-hidden="true">
          {t("file.uploading", { percent })}
        </p>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div className="flex items-center gap-3 rounded-card border border-line bg-paper p-4">
        <CheckCircle2
          size={20}
          strokeWidth={1.5}
          aria-hidden="true"
          className="shrink-0 text-ink"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{state.name}</p>
          <p className="s3d-label mt-0.5 normal-case text-soft">
            {formatBytes(state.bytes, locale)} · {t("file.attached")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label={t("file.remove", { name: state.name })}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-field text-soft transition-colors hover:bg-line/60 hover:text-accent-text"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type="file"
          accept={QUOTE_UPLOAD_ACCEPT}
          onChange={onChange}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cx(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-card border-2 border-dashed px-5 py-8 text-center transition-colors duration-150 ease-strate",
            "hover:border-ink peer-focus-visible:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink/20",
            over ? "border-ink bg-surface" : "border-iso bg-paper",
          )}
        >
          <Upload
            size={28}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-ink"
          />
          <span className="mt-1 text-base font-semibold text-ink">
            {over ? t("file.dropActive") : t("file.drop")}
          </span>
          <span className="text-sm text-soft">{t("file.browse")}</span>
          <span className="s3d-label mt-2 normal-case text-soft">
            {tCustom("fileHint")}
          </span>
        </label>
      </div>
      {state.status === "error" ? (
        <p
          role="alert"
          className="mt-2 text-sm font-medium text-accent-text"
        >
          {t(`errors.${state.code}`, { email: QUOTE_CONTACT_EMAIL })}
        </p>
      ) : null}
      <noscript>
        <p className="mt-2 text-sm text-soft">
          {t("file.noscript", { email: QUOTE_CONTACT_EMAIL })}
        </p>
      </noscript>
    </div>
  );
}
