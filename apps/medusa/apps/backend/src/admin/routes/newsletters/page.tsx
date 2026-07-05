import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import { Container, Heading, Text, Input, Textarea, Button, Select } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type Audience = "newsletter" | "product_news" | "both"
const AUDIENCE_LABEL: Record<Audience, string> = {
  newsletter: "Newsletter",
  product_news: "Nouveautés produits",
  both: "Les deux",
}

type Product = { id: string; title: string }

type NewsletterSend = {
  id: string
  subject: string
  audience: Audience
  recipient_count: number
  created_at: string
}

const MAX_PRODUCTS = 4

const NewslettersPage = () => {
  const queryClient = useQueryClient()

  const [subject, setSubject] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [audience, setAudience] = useState<Audience>("newsletter")
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [bannerImageUrl, setBannerImageUrl] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")

  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: productsData } = useQuery({
    queryKey: ["admin-newsletters-products"],
    queryFn: async () => {
      const res = await fetch("/admin/products?status[]=published&fields=id,title&limit=100", {
        credentials: "include",
      })
      return (await res.json()) as { products: Product[] }
    },
  })

  const { data: historyData } = useQuery({
    queryKey: ["admin-newsletters"],
    queryFn: async () => {
      const res = await fetch("/admin/newsletters", { credentials: "include" })
      return (await res.json()) as { sends: NewsletterSend[] }
    },
  })

  function composeInput() {
    return {
      subject: subject.trim(),
      bodyText: bodyText.trim(),
      audience,
      productIds: selectedProductIds,
      bannerImageUrl: bannerImageUrl.trim() || null,
      ctaLabel: ctaLabel.trim(),
      ctaUrl: ctaUrl.trim(),
    }
  }

  const preview = useMutation({
    mutationFn: async () => {
      const res = await fetch("/admin/newsletters/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeInput()),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Erreur")
      return json as { subject: string; html: string; recipientCount: number }
    },
    onSuccess: (data) => {
      setFormError(null)
      setPreviewCount(data.recipientCount)
      const blob = new Blob([data.html], { type: "text/html" })
      window.open(URL.createObjectURL(blob), "_blank")
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const sendTest = useMutation({
    mutationFn: async () => {
      const res = await fetch("/admin/newsletters/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeInput()),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Erreur")
      return json
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch("/admin/newsletters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeInput()),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Erreur")
      return json as { count: number }
    },
    onSuccess: () => {
      setFormError(null)
      setSubject("")
      setBodyText("")
      setSelectedProductIds([])
      setBannerImageUrl("")
      setCtaLabel("")
      setCtaUrl("")
      setPreviewCount(null)
      queryClient.invalidateQueries({ queryKey: ["admin-newsletters"] })
    },
    onError: (err: Error) => setFormError(err.message),
  })

  function toggleProduct(id: string) {
    setSelectedProductIds((current) =>
      current.includes(id)
        ? current.filter((p) => p !== id)
        : current.length < MAX_PRODUCTS
          ? [...current, id]
          : current,
    )
  }

  const canSubmit = subject.trim().length >= 3 && bodyText.trim().length >= 10

  return (
    <Container>
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Annonces newsletter</Heading>
      </div>
      <Text className="px-6 pb-4 text-ui-fg-subtle">
        Composez une annonce et envoyez-la aux clients inscrits (préférences gérées par chaque
        client dans son compte).
      </Text>

      <div className="flex max-w-2xl flex-col gap-4 px-6 pb-6">
        <div>
          <Text size="small" weight="plus" className="mb-1">
            Objet
          </Text>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        </div>

        <div>
          <Text size="small" weight="plus" className="mb-1">
            Message
          </Text>
          <Textarea
            rows={6}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Paragraphes séparés par une ligne vide."
          />
        </div>

        <div>
          <Text size="small" weight="plus" className="mb-1">
            Cible
          </Text>
          <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
            <Select.Trigger className="w-56">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {(["newsletter", "product_news", "both"] as const).map((a) => (
                <Select.Item key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div>
          <Text size="small" weight="plus" className="mb-1">
            Produits mis en avant ({selectedProductIds.length}/{MAX_PRODUCTS})
          </Text>
          <div className="border-ui-border-base flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
            {productsData?.products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(p.id)}
                  disabled={
                    !selectedProductIds.includes(p.id) &&
                    selectedProductIds.length >= MAX_PRODUCTS
                  }
                  onChange={() => toggleProduct(p.id)}
                />
                {p.title}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Text size="small" weight="plus" className="mb-1">
            Image de bannière (URL, optionnel)
          </Text>
          <Input value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Text size="small" weight="plus" className="mb-1">
              Bouton — libellé
            </Text>
            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
          <div className="flex-1">
            <Text size="small" weight="plus" className="mb-1">
              Bouton — lien
            </Text>
            <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" />
          </div>
        </div>

        {formError && <Text className="text-ui-fg-error">{formError}</Text>}
        {previewCount !== null && (
          <Text size="small" className="text-ui-fg-subtle">
            {previewCount} destinataire{previewCount > 1 ? "s" : ""} pour cette cible.
          </Text>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!canSubmit || preview.isPending}
            onClick={() => preview.mutate()}
          >
            Aperçu
          </Button>
          <Button
            variant="secondary"
            disabled={!canSubmit || sendTest.isPending}
            onClick={() => sendTest.mutate()}
          >
            {sendTest.isSuccess ? "Test envoyé ✓" : "M'envoyer un test"}
          </Button>
          <Button
            disabled={!canSubmit || send.isPending}
            onClick={() => {
              if (confirm("Envoyer cette annonce à tous les destinataires de la cible choisie ?")) {
                send.mutate()
              }
            }}
          >
            Envoyer à tous
          </Button>
        </div>
      </div>

      {historyData && historyData.sends.length > 0 && (
        <div className="border-ui-border-base border-t px-6 py-6">
          <Text weight="plus" className="mb-3">
            Historique
          </Text>
          <ul className="flex flex-col gap-2">
            {historyData.sends.map((s) => (
              <li
                key={s.id}
                className="border-ui-border-base flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              >
                <Text weight="plus" size="small">
                  {s.subject}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {AUDIENCE_LABEL[s.audience]} · {s.recipient_count} destinataires ·{" "}
                  {new Date(s.created_at).toLocaleDateString("fr-CH")}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Annonces",
  icon: Envelope,
})

export default NewslettersPage
