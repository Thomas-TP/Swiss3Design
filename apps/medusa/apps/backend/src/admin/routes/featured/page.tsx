import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Star } from "@medusajs/icons"
import { Container, Heading, Text, Button, IconButton } from "@medusajs/ui"
import { ArrowUpMini, ArrowDownMini, Plus, XMark } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

function Thumbnail({ src }: { src: string | null }) {
  return (
    <div className="bg-ui-bg-subtle border-ui-border-base h-10 w-10 shrink-0 overflow-hidden rounded-md border">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  )
}

type Product = {
  id: string
  title: string
  thumbnail: string | null
  featured: boolean
  featured_order: number
}

const QUERY_KEY = ["admin-featured"]

const FeaturedPage = () => {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/admin/featured", { credentials: "include" })
      return (await res.json()) as { products: Product[] }
    },
  })

  const save = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await fetch("/admin/featured", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const products = data?.products ?? []
  const selected = products.filter((p) => p.featured).sort((a, b) => a.featured_order - b.featured_order)
  const available = products.filter((p) => !p.featured)

  function persist(nextSelectedIds: string[]) {
    save.mutate(nextSelectedIds)
  }

  function add(id: string) {
    persist([...selected.map((p) => p.id), id])
  }

  function remove(id: string) {
    persist(selected.filter((p) => p.id !== id).map((p) => p.id))
  }

  function move(id: string, direction: -1 | 1) {
    const ids = selected.map((p) => p.id)
    const index = ids.indexOf(id)
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= ids.length) return
    ;[ids[index], ids[swapWith]] = [ids[swapWith], ids[index]]
    persist(ids)
  }

  return (
    <Container>
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Sélection du moment</Heading>
      </div>
      <Text className="px-6 pb-6 text-ui-fg-subtle">
        Choisissez les produits mis en avant sur la page d'accueil et réglez leur ordre avec les
        flèches. Chaque changement est enregistré immédiatement.
      </Text>

      {!isLoading && (
        <div className="grid grid-cols-2 gap-6 px-6 pb-6">
          <div>
            <Text weight="plus" className="mb-2">
              Sélection ({selected.length})
            </Text>
            <div className="flex flex-col gap-2">
              {selected.map((p, index) => (
                <div
                  key={p.id}
                  className="border-ui-border-base flex items-center gap-3 rounded-lg border p-2"
                >
                  <Thumbnail src={p.thumbnail} />
                  <Text className="flex-1 truncate">{p.title}</Text>
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={index === 0}
                    onClick={() => move(p.id, -1)}
                  >
                    <ArrowUpMini />
                  </IconButton>
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={index === selected.length - 1}
                    onClick={() => move(p.id, 1)}
                  >
                    <ArrowDownMini />
                  </IconButton>
                  <IconButton size="small" variant="transparent" onClick={() => remove(p.id)}>
                    <XMark />
                  </IconButton>
                </div>
              ))}
              {selected.length === 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  Aucun produit mis en avant.
                </Text>
              )}
            </div>
          </div>

          <div>
            <Text weight="plus" className="mb-2">
              Disponibles ({available.length})
            </Text>
            <div className="flex flex-col gap-2">
              {available.map((p) => (
                <div
                  key={p.id}
                  className="border-ui-border-base flex items-center gap-3 rounded-lg border p-2"
                >
                  <Thumbnail src={p.thumbnail} />
                  <Text className="flex-1 truncate">{p.title}</Text>
                  <Button variant="secondary" size="small" onClick={() => add(p.id)}>
                    <Plus />
                    Ajouter
                  </Button>
                </div>
              ))}
              {available.length === 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  Tous les produits publiés sont déjà mis en avant.
                </Text>
              )}
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Vedettes",
  icon: Star,
})

export default FeaturedPage
