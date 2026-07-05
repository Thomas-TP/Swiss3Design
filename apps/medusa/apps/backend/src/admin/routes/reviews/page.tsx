import { defineRouteConfig } from "@medusajs/admin-sdk"
import { StarSolid, Star } from "@medusajs/icons"
import { Container, Heading, Text, Badge, Button, Select } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type Review = {
  id: string
  product_title: string
  author_name: string
  rating: number
  body: string | null
  status: "pending" | "published" | "rejected"
  created_at: string
}

const STATUS_LABEL: Record<Review["status"], string> = {
  pending: "En attente",
  published: "Publié",
  rejected: "Rejeté",
}
const STATUS_COLOR: Record<Review["status"], "orange" | "green" | "red"> = {
  pending: "orange",
  published: "green",
  rejected: "red",
}
const ALL_STATUSES = "all"

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        n <= value ? (
          <StarSolid key={n} className="text-ui-tag-orange-icon" />
        ) : (
          <Star key={n} className="text-ui-fg-muted" />
        ),
      )}
    </div>
  )
}

const ReviewsPage = () => {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(ALL_STATUSES)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status !== ALL_STATUSES) params.set("status", status)
      const res = await fetch(`/admin/reviews?${params}`, { credentials: "include" })
      return (await res.json()) as { reviews: Review[] }
    },
  })

  const setReviewStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Review["status"] }) => {
      await fetch(`/admin/reviews/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reviews", status] }),
  })

  const reviews = data?.reviews ?? []
  const pending = reviews.filter((r) => r.status === "pending").length

  return (
    <Container>
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Avis clients</Heading>
      </div>
      <Text className="px-6 pb-4 text-ui-fg-subtle">
        {reviews.length} avis · {pending} en attente de modération
      </Text>
      <div className="px-6 pb-4">
        <Select value={status} onValueChange={setStatus}>
          <Select.Trigger className="w-48">
            <Select.Value placeholder="Tous les statuts" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL_STATUSES}>Tous les statuts</Select.Item>
            {(["pending", "published", "rejected"] as const).map((s) => (
              <Select.Item key={s} value={s}>
                {STATUS_LABEL[s]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-6">
        {!isLoading && reviews.length === 0 && (
          <Text className="text-ui-fg-subtle">Aucun avis pour l'instant.</Text>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="border-ui-border-base rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                <Text weight="plus" size="small">
                  {r.product_title}
                </Text>
                <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                {r.author_name} · {new Date(r.created_at).toLocaleDateString("fr-CH")}
              </Text>
            </div>
            {r.body && (
              <Text size="small" className="text-ui-fg-subtle mt-2">
                {r.body}
              </Text>
            )}
            <div className="mt-3 flex gap-2">
              {r.status !== "published" && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setReviewStatus.mutate({ id: r.id, status: "published" })}
                >
                  Publier
                </Button>
              )}
              {r.status !== "rejected" && (
                <Button
                  size="small"
                  variant="danger"
                  onClick={() => setReviewStatus.mutate({ id: r.id, status: "rejected" })}
                >
                  Rejeter
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Avis",
  icon: StarSolid,
})

export default ReviewsPage
