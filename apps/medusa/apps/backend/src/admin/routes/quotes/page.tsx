import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Container, Heading, Table, Badge, Input, Select } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

type Quote = {
  id: string
  email: string
  description: string
  status: string
  quoted_price: number | null
  created_at: string
}

const STATUS_COLOR: Record<string, "grey" | "orange" | "blue" | "green" | "red"> = {
  received: "grey",
  quoted: "blue",
  revision_requested: "orange",
  accepted: "blue",
  declined: "red",
  paid: "green",
  in_production: "green",
  done: "green",
  rejected: "red",
}

const ALL_STATUSES = "all"

const QuotesPage = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState(ALL_STATUSES)
  const [q, setQ] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-quotes", status, q],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status !== ALL_STATUSES) params.set("status", status)
      if (q) params.set("q", q)
      const res = await fetch(`/admin/quotes?${params}`, { credentials: "include" })
      return (await res.json()) as { quotes: Quote[] }
    },
  })

  return (
    <Container>
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Devis sur mesure</Heading>
      </div>
      <div className="flex gap-2 px-6 pb-4">
        <Input
          placeholder="Rechercher (email, description)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <Select.Trigger className="w-48">
            <Select.Value placeholder="Tous les statuts" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL_STATUSES}>Tous les statuts</Select.Item>
            {Object.keys(STATUS_COLOR).map((s) => (
              <Select.Item key={s} value={s}>
                {s}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Description</Table.HeaderCell>
            <Table.HeaderCell>Statut</Table.HeaderCell>
            <Table.HeaderCell>Prix</Table.HeaderCell>
            <Table.HeaderCell>Reçu le</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {!isLoading &&
            data?.quotes.map((quote) => (
              <Table.Row
                key={quote.id}
                className="cursor-pointer"
                onClick={() => navigate(`/quotes/${quote.id}`)}
              >
                <Table.Cell>{quote.email}</Table.Cell>
                <Table.Cell className="max-w-xs truncate">{quote.description}</Table.Cell>
                <Table.Cell>
                  <Badge color={STATUS_COLOR[quote.status] ?? "grey"}>{quote.status}</Badge>
                </Table.Cell>
                <Table.Cell>{quote.quoted_price ? `${quote.quoted_price} CHF` : "—"}</Table.Cell>
                <Table.Cell>{new Date(quote.created_at).toLocaleDateString("fr-CH")}</Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Devis",
  icon: ChatBubbleLeftRight,
})

export default QuotesPage
