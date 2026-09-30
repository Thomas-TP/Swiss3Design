"use client";

import { useActionState, useEffect, useState } from "react";
import {
  ArrowRight,
  Pencil,
  X,
  Paperclip,
  Send,
  Ban,
  Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  requestQuoteRevision,
  declineQuote,
  type QuoteActionState,
} from "../actions";
import {
  alertError,
  btnAccent,
  btnDanger,
  btnGhost,
  btnPrimary,
  card,
  field,
} from "../../_ui";

const initial: QuoteActionState = { status: "idle" };

export function QuoteActions({
  quoteId,
  canPay,
  canRevise,
  canDecline,
}: {
  quoteId: string;
  canPay: boolean;
  canRevise: boolean;
  canDecline: boolean;
}) {
  const t = useTranslations("account.quoteActions");
  const router = useRouter();
  const [panel, setPanel] = useState<"none" | "revise" | "decline">("none");

  return (
    <div className="mt-6">
      {/* Boutons principaux */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        {canPay && (
          <button
            type="button"
            onClick={() => router.push(`/account/quotes/${quoteId}/pay`)}
            className={`${btnAccent} flex-1`}
          >
            <Check size={16} strokeWidth={1.5} />
            {t("accept")}
          </button>
        )}
        {canRevise && (
          <button
            type="button"
            onClick={() => setPanel(panel === "revise" ? "none" : "revise")}
            className={btnGhost}
          >
            <Pencil size={15} strokeWidth={1.5} />
            {canPay ? t("revise") : t("reviseExpired")}
          </button>
        )}
        {canDecline && (
          <button
            type="button"
            onClick={() => setPanel(panel === "decline" ? "none" : "decline")}
            className={btnGhost}
          >
            <Ban size={15} strokeWidth={1.5} />
            {t("decline")}
          </button>
        )}
      </div>

      {panel === "revise" && (
        <RevisePanel
          quoteId={quoteId}
          onDone={() => router.refresh()}
          onClose={() => setPanel("none")}
        />
      )}
      {panel === "decline" && (
        <DeclinePanel
          quoteId={quoteId}
          onDone={() => router.refresh()}
          onClose={() => setPanel("none")}
        />
      )}
    </div>
  );
}

function RevisePanel({
  quoteId,
  onDone,
  onClose,
}: {
  quoteId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("account.quoteActions");
  const [state, formAction, pending] = useActionState(
    requestQuoteRevision,
    initial,
  );
  const [file, setFile] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState(false);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state.status, onDone]);

  async function onFile(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) return;
    setUploading(true);
    setFileError(false);
    try {
      const body = new FormData();
      body.append("file", selected);
      const res = await fetch("/api/quote-upload", { method: "POST", body });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { key: string; fileName: string };
      setFile({ key: data.key, name: data.fileName });
    } catch {
      setFileError(true);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  return (
    <form action={formAction} className={`${card} mt-3 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("reviseTitle")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("reviseDesc")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("cancel")}
          className="rounded-field p-1.5 text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <input type="hidden" name="quoteId" value={quoteId} />
      <textarea
        name="message"
        required
        minLength={5}
        rows={4}
        placeholder={t("revisePlaceholder")}
        className={field}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-field border border-line bg-paper px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip
              size={15}
              strokeWidth={1.5}
              className="shrink-0 text-soft"
            />
            <span className="truncate font-medium">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="×"
            className="rounded-field p-1.5 text-soft transition-colors duration-150 hover:bg-line/60 hover:text-accent-text"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-field border-2 border-dashed border-swatch-ring px-4 py-3.5 text-sm font-medium text-soft transition-colors duration-150 hover:border-ink hover:text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          <Paperclip size={16} strokeWidth={1.5} />
          {uploading ? t("fileUploading") : t("fileHint")}
          <input
            type="file"
            accept=".stl,.3mf,.obj,.step,.stp"
            disabled={uploading}
            onChange={(e) => onFile(e.currentTarget)}
            className="hidden"
          />
        </label>
      )}
      {fileError && (
        <p className="text-sm font-medium text-accent-text">{t("fileError")}</p>
      )}
      {file && <input type="hidden" name="fileKey" value={file.key} />}
      {file && <input type="hidden" name="fileName" value={file.name} />}

      {state.status === "error" && <p className={alertError}>{t("error")}</p>}

      <button
        type="submit"
        disabled={pending || uploading}
        className={`${btnPrimary} w-full`}
      >
        <Send size={15} strokeWidth={1.5} />
        {pending ? t("sending") : t("reviseSubmit")}
      </button>
    </form>
  );
}

function DeclinePanel({
  quoteId,
  onDone,
  onClose,
}: {
  quoteId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("account.quoteActions");
  const [state, formAction, pending] = useActionState(declineQuote, initial);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state.status, onDone]);

  return (
    <form action={formAction} className={`${card} mt-3 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("declineTitle")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("declineDesc")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("cancel")}
          className="rounded-field p-1.5 text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <input type="hidden" name="quoteId" value={quoteId} />
      <textarea
        name="reason"
        rows={3}
        placeholder={t("declineReasonPlaceholder")}
        className={field}
      />

      {state.status === "error" && <p className={alertError}>{t("error")}</p>}

      <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={pending}
          className={`${btnDanger} flex-1`}
        >
          <Ban size={15} strokeWidth={1.5} />
          {pending ? t("sending") : t("declineConfirm")}
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          {t("keep")}
          <ArrowRight size={15} strokeWidth={1.5} />
        </button>
      </div>
    </form>
  );
}
