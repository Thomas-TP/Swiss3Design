import { Container, Heading, Text, Badge, Textarea, Input, Button, Select } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useParams } from "react-router-dom"

type QuoteMessage = {
  id: string
  sender: "customer" | "admin"
  body: string
  price: number | null
  file_url: string | null
  file_name: string | null
  created_at: string
}

type Quote = {
  id: string
  email: string
  description: string
  material: string | null
  colors: string | null
  dimensions: string | null
  file_url: string | null
  file_name: string | null
  status: string
  quoted_price: number | null
  admin_message: string | null
  valid_until: string | null
  admin_note: string | null
  messages: QuoteMessage[]
}

const STATUSES = [
  "received",
  "quoted",
  "revision_requested",
  "accepted",
  "declined",
  "paid",
  "in_production",
  "done",
  "rejected",
]

const QuoteDetailPage = () => {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>()
  const [price, setPrice] = useState("")
  const [replyBody, setReplyBody] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-quote", id],
    queryFn: async () => {
      const res = await fetch(`/admin/quotes/${id}`, { credentials: "include" })
      const json = (await res.json()) as { quote: Quote }
      setStatus(json.quote.status)
      return json
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await fetch(`/admin/quotes/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-quote", id] }),
  })

  const replyMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/admin/quotes/${id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: replyBody,
          price: price ? Number(price) : undefined,
        }),
      })
    },
    onSuccess: () => {
      setReplyBody("")
      setPrice("")
      queryClient.invalidateQueries({ queryKey: ["admin-quote", id] })
    },
  })

  if (isLoading || !data) {
    return (
      <Container>
        <Text>Chargement...</Text>
      </Container>
    )
  }

  const quote = data.quote

  return (
    <Container className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <Heading level="h1">Devis de {quote.email}</Heading>
        <Badge>{quote.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Text weight="plus">Description</Text>
          <Text>{quote.description}</Text>
        </div>
        <div>
          <Text weight="plus">Matière / couleurs / dimensions</Text>
          <Text>
            {quote.material ?? "—"} / {quote.colors ?? "—"} / {quote.dimensions ?? "—"}
          </Text>
        </div>
        {quote.file_url && (
          <div>
            <Text weight="plus">Fichier 3D</Text>
            <a href={quote.file_url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
              {quote.file_name ?? "Télécharger"}
            </a>
          </div>
        )}
        {quote.valid_until && (
          <div>
            <Text weight="plus">Devis valide jusqu'au</Text>
            <Text>{new Date(quote.valid_until).toLocaleDateString("fr-CH")}</Text>
          </div>
        )}
      </div>

      <div className="border-ui-border-base rounded-lg border p-4">
        <Heading level="h2" className="mb-4">
          Statut & prix
        </Heading>
        <div className="flex items-end gap-2">
          <Select value={status} onValueChange={setStatus}>
            <Select.Trigger className="w-56">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {STATUSES.map((s) => (
                <Select.Item key={s} value={s}>
                  {s}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            variant="secondary"
            onClick={() => status && updateMutation.mutate({ status })}
          >
            Mettre à jour le statut
          </Button>
        </div>
      </div>

      <div className="border-ui-border-base rounded-lg border p-4">
        <Heading level="h2" className="mb-4">
          Conversation ({quote.messages?.length ?? 0})
        </Heading>
        <div className="flex flex-col gap-3">
          {quote.messages?.map((m) => (
            <div
              key={m.id}
              className={
                m.sender === "admin"
                  ? "bg-ui-bg-subtle ml-auto max-w-lg rounded-lg p-3"
                  : "bg-ui-bg-field max-w-lg rounded-lg p-3"
              }
            >
              <Text size="small" weight="plus">
                {m.sender === "admin" ? "Atelier" : "Client"} —{" "}
                {new Date(m.created_at).toLocaleString("fr-CH")}
              </Text>
              <Text>{m.body}</Text>
              {m.price != null && <Text weight="plus">Prix proposé : {m.price} CHF</Text>}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Textarea
            placeholder="Répondre au client..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Prix (CHF, optionnel = re-devis)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-64"
            />
            <Button
              disabled={!replyBody.trim()}
              onClick={() => replyMutation.mutate()}
            >
              Envoyer
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}

export default QuoteDetailPage
