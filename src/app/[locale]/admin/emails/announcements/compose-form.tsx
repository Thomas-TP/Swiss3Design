"use client";

import { useRef, useState } from "react";
import {
  Eye,
  Send,
  Pencil,
  ImagePlus,
  X,
  FlaskConical,
  Check,
} from "lucide-react";
import { FIELD, BTN_PRIMARY, BTN_GHOST } from "../../ui";
import {
  previewAnnouncement,
  sendAnnouncement,
  sendTestEmail,
} from "./actions";

interface Product {
  id: string;
  name: string;
  priceLabel: string;
  imageUrl: string | null;
}

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "newsletter", label: "Newsletter" },
  { value: "product_news", label: "Nouveautés produits" },
  { value: "both", label: "Les deux" },
];

const MAX_PRODUCTS = 4;

export function ComposeForm({ products }: { products: Product[] }) {
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [audience, setAudience] = useState("newsletter");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"compose" | "preview">("compose");
  const [previewHtml, setPreviewHtml] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  function toggleProduct(id: string) {
    setProductIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < MAX_PRODUCTS
          ? [...prev, id]
          : prev,
    );
  }

  async function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBannerUploading(true);
    setBannerError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "newsletter");
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      if (!res.ok) {
        throw new Error(
          res.status === 413
            ? "fichier trop lourd (max 8 Mo)"
            : res.status === 415
              ? "format non supporté (JPG, PNG, WebP, AVIF)"
              : `erreur serveur (${res.status})`,
        );
      }
      const { url } = (await res.json()) as { url: string };
      setBannerImageUrl(url);
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : "échec de l'envoi");
    } finally {
      setBannerUploading(false);
    }
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("bodyText", bodyText);
    fd.set("audience", audience);
    for (const id of productIds) fd.append("productIds", id);
    fd.set("bannerImageUrl", bannerImageUrl ?? "");
    fd.set("ctaLabel", ctaLabel);
    fd.set("ctaUrl", ctaUrl);
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

  async function onSendTest() {
    setTestSending(true);
    setTestMessage(null);
    setError(null);
    const res = await sendTestEmail(buildFormData());
    setTestSending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setTestMessage("Envoyé — vérifiez votre boîte mail.");
    setTimeout(() => setTestMessage(null), 4000);
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
    setProductIds([]);
    setBannerImageUrl(null);
    setCtaLabel("");
    setCtaUrl("");
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
          {recipientCount} destinataire{recipientCount > 1 ? "s" : ""} recevront
          cet e-mail.
        </div>
        <iframe
          srcDoc={previewHtml}
          title="Aperçu de l'annonce"
          sandbox=""
          className="w-full rounded-card border border-line bg-paper"
          style={{ height: 560 }}
        />
        {error && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
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
            onClick={onSendTest}
            disabled={testSending}
            className={BTN_GHOST}
          >
            <FlaskConical size={14} />
            {testSending ? "Envoi…" : "Envoyer un test à moi-même"}
          </button>
          {testMessage && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <Check size={13} />
              {testMessage}
            </span>
          )}
          <button
            type="button"
            onClick={onConfirmSend}
            disabled={pending || recipientCount === 0}
            className={`${BTN_PRIMARY} ml-auto`}
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
    <form onSubmit={onPreview} className="space-y-5">
      <div>
        <label
          htmlFor="compose-banner-input"
          className="mb-1.5 block text-sm font-semibold"
        >
          Image de bannière (facultatif)
        </label>
        {bannerImageUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-line">
            <img
              src={bannerImageUrl}
              alt=""
              className="h-32 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => setBannerImageUrl(null)}
              className="absolute right-2 top-2 rounded-full bg-ink/80 p-1.5 text-paper hover:bg-ink"
              aria-label="Retirer la bannière"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={bannerUploading}
            className={`${BTN_GHOST} w-full justify-center py-6`}
          >
            <ImagePlus size={16} />
            {bannerUploading
              ? "Envoi…"
              : "Ajouter une bannière (JPG, PNG, WebP)"}
          </button>
        )}
        <input
          id="compose-banner-input"
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={onBannerChange}
          className="hidden"
        />
        {bannerError && (
          <p className="mt-1.5 text-xs text-accent">{bannerError}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="compose-subject"
          className="mb-1.5 block text-sm font-semibold"
        >
          Objet
        </label>
        <input
          id="compose-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          className={FIELD}
        />
      </div>
      <div>
        <label
          htmlFor="compose-body"
          className="mb-1.5 block text-sm font-semibold"
        >
          Message
        </label>
        <textarea
          id="compose-body"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          required
          minLength={10}
          rows={6}
          placeholder="Un paragraphe par ligne vide entre les paragraphes."
          className={FIELD}
        />
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-semibold">
          Produits à mettre en avant (facultatif, {MAX_PRODUCTS} max —{" "}
          {productIds.length} sélectionné{productIds.length > 1 ? "s" : ""})
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-1.5">
          {products.map((p) => {
            const checked = productIds.includes(p.id);
            const disabled = !checked && productIds.length >= MAX_PRODUCTS;
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                  disabled ? "opacity-40" : "cursor-pointer hover:bg-line/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleProduct(p.id)}
                  className="size-4 shrink-0 accent-accent"
                />
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="size-9 shrink-0 rounded-md bg-line" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-soft">
                  {p.priceLabel}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="compose-audience"
            className="mb-1.5 block text-sm font-semibold"
          >
            Destinataires
          </label>
          <select
            id="compose-audience"
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
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-semibold">
          Bouton d’appel à l’action (facultatif)
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Ex. Voir tout le catalogue"
            className={FIELD}
          />
          <input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://swiss3design.ch/fr/shop"
            className={FIELD}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={BTN_PRIMARY}>
        <Eye size={14} />
        {pending ? "Chargement…" : "Aperçu"}
      </button>
    </form>
  );
}
