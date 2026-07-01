"use client";

import { useState } from "react";
import { Eye, Send, Pencil } from "lucide-react";
import { FIELD, BTN_PRIMARY, BTN_GHOST } from "../../ui";
import { previewAnnouncement, sendAnnouncement } from "./actions";

interface Product {
  id: string;
  label: string;
}

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "newsletter", label: "Newsletter" },
  { value: "product_news", label: "Nouveautés produits" },
  { value: "both", label: "Les deux" },
];

export function ComposeForm({ products }: { products: Product[] }) {
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [audience, setAudience] = useState("newsletter");
  const [productId, setProductId] = useState("");

  const [step, setStep] = useState<"compose" | "preview">("compose");
  const [previewHtml, setPreviewHtml] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("bodyText", bodyText);
    fd.set("audience", audience);
    fd.set("productId", productId);
    return fd;
  }

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await previewAnnouncement(buildFormData());
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPreviewHtml(res.html);
    setRecipientCount(res.recipientCount);
    setStep("preview");
  }

  async function onConfirmSend() {
    setPending(true);
    setError(null);
    const res = await sendAnnouncement(buildFormData());
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSentCount(res.count);
    setStep("compose");
    setSubject("");
    setBodyText("");
    setProductId("");
  }

  if (sentCount !== null) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <p className="font-medium text-emerald-800 dark:text-emerald-200">
          Annonce envoyée à {sentCount} destinataire{sentCount > 1 ? "s" : ""}.
        </p>
        <button
          type="button"
          onClick={() => setSentCount(null)}
          className={`${BTN_GHOST} mt-4`}
        >
          Nouvelle annonce
        </button>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">
          {recipientCount} destinataire{recipientCount > 1 ? "s" : ""} recevront cet
          e-mail.
        </div>
        <iframe
          srcDoc={previewHtml}
          title="Aperçu de l'annonce"
          sandbox=""
          className="w-full rounded-card border border-line bg-paper"
          style={{ height: 480 }}
        />
        {error && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {error}
          </p>
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setStep("compose")}
            className={BTN_GHOST}
          >
            <Pencil size={14} />
            Modifier
          </button>
          <button
            type="button"
            onClick={onConfirmSend}
            disabled={pending || recipientCount === 0}
            className={BTN_PRIMARY}
          >
            <Send size={14} />
            {pending
              ? "Envoi en cours…"
              : `Confirmer l'envoi à ${recipientCount} destinataire${recipientCount > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onPreview} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold">Objet</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          className={FIELD}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold">Message</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          required
          minLength={10}
          rows={6}
          placeholder="Un paragraphe par ligne vide entre les paragraphes."
          className={FIELD}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Destinataires</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={FIELD}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">
            Produit à mettre en avant (facultatif)
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={FIELD}
          >
            <option value="">Aucun</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={BTN_PRIMARY}
      >
        <Eye size={14} />
        {pending ? "Chargement…" : "Aperçu"}
      </button>
    </form>
  );
}
