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

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

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
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98]"
          >
            <Check size={16} />
            {t("accept")}
          </button>
        )}
        {canRevise && (
          <button
            type="button"
            onClick={() => setPanel(panel === "revise" ? "none" : "revise")}
            className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
          >
            <Pencil size={15} />
            {canPay ? t("revise") : t("reviseExpired")}
          </button>
        )}
        {canDecline && (
          <button
            type="button"
            onClick={() => setPanel(panel === "decline" ? "none" : "decline")}
            className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3.5 text-sm font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
          >
            <Ban size={15} />
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
    <form
      action={formAction}
      className="mt-3 space-y-4 rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("reviseTitle")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("reviseDesc")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("cancel")}
          className="rounded-full p-1 text-soft transition-colors hover:bg-line/60 hover:text-ink"
        >
          <X size={16} />
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
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip size={15} className="shrink-0 text-soft" />
            <span className="truncate font-medium">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="×"
            className="rounded-full p-1 text-soft transition-colors hover:bg-line/60 hover:text-accent"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-3.5 text-sm font-medium text-soft transition-colors hover:border-ink hover:text-ink">
          <Paperclip size={16} />
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
        <p className="text-xs font-medium text-accent">{t("fileError")}</p>
      )}
      {file && <input type="hidden" name="fileKey" value={file.key} />}
      {file && <input type="hidden" name="fileName" value={file.name} />}

      {state.status === "error" && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {t("error")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Send size={15} />
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
    <form
      action={formAction}
      className="mt-3 space-y-4 rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("declineTitle")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("declineDesc")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("cancel")}
          className="rounded-full p-1 text-soft transition-colors hover:bg-line/60 hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <input type="hidden" name="quoteId" value={quoteId} />
      <textarea
        name="reason"
        rows={3}
        placeholder={t("declineReasonPlaceholder")}
        className={field}
      />

      {state.status === "error" && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {t("error")}
        </p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
        >
          <Ban size={15} />
          {pending ? t("sending") : t("declineConfirm")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink"
        >
          {t("keep")}
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
