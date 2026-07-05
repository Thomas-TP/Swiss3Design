import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Swatch } from "@medusajs/icons"
import { Container, Heading, Text, Input, Button } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type Color = { id: string; name: string; hex: string }
type Material = { id: string; name: string; count: number; colors: Color[] }

const QUERY_KEY = ["admin-materials"]

const MaterialsPage = () => {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/admin/materials", { credentials: "include" })
      return (await res.json()) as { materials: Material[] }
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const addMaterial = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/admin/materials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { message?: string }
        throw new Error(body.message ?? "Erreur lors de l'ajout.")
      }
    },
    onSuccess: () => {
      setNewName("")
      invalidate()
    },
  })

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/admin/materials/${id}`, { method: "DELETE", credentials: "include" })
    },
    onSuccess: invalidate,
  })

  return (
    <Container>
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Filaments &amp; couleurs</Heading>
      </div>
      <Text className="px-6 pb-4 text-ui-fg-subtle">
        Vos filaments et, pour chacun, sa palette de couleurs. Les couleurs définies ici
        sont proposées à la création d&apos;un produit, puis affichées en pastilles
        sélectionnables dans la boutique.
      </Text>

      <div className="flex items-start gap-2 px-6 pb-6">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Nom du filament (ex. PLA Silk)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
          />
          {addMaterial.isError && (
            <Text size="small" className="mt-1 text-ui-fg-error">
              {(addMaterial.error as Error).message}
            </Text>
          )}
        </div>
        <Button
          disabled={!newName.trim() || addMaterial.isPending}
          onClick={() => addMaterial.mutate(newName.trim())}
        >
          Ajouter un filament
        </Button>
      </div>

      {!isLoading && data?.materials.length === 0 && (
        <Text className="px-6 pb-6 text-ui-fg-subtle">Aucun filament pour l&apos;instant.</Text>
      )}

      <div className="flex flex-col gap-4 px-6 pb-6">
        {data?.materials.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            onDelete={() => deleteMaterial.mutate(material.id)}
            onChanged={invalidate}
          />
        ))}
      </div>
    </Container>
  )
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function MaterialCard({
  material,
  onDelete,
  onChanged,
}: {
  material: Material
  onDelete: () => void
  onChanged: () => void
}) {
  const [colorName, setColorName] = useState("")
  const [hex, setHex] = useState("#E5231C")

  const addColor = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/admin/materials/${material.id}/colors`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: colorName.trim(), hex }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { message?: string }
        throw new Error(body.message ?? "Erreur lors de l'ajout de la couleur.")
      }
    },
    onSuccess: () => {
      setColorName("")
      onChanged()
    },
  })

  const deleteColor = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/admin/materials/colors/${id}`, { method: "DELETE", credentials: "include" })
    },
    onSuccess: onChanged,
  })

  return (
    <div className="border-ui-border-base rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Swatch className="text-ui-fg-subtle" />
        <div className="flex-1">
          <Text weight="plus">{material.name}</Text>
          <Text size="small" className="text-ui-fg-subtle">
            {material.count} produit{material.count > 1 ? "s" : ""} · {material.colors.length}{" "}
            couleur{material.colors.length > 1 ? "s" : ""}
          </Text>
        </div>
        <Button variant="danger" size="small" onClick={onDelete}>
          Supprimer
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {material.colors.map((c) => (
          <span
            key={c.id}
            className="border-ui-border-base bg-ui-bg-subtle inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-2 text-xs font-medium"
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-ui-border-base"
              style={{ backgroundColor: c.hex }}
            />
            {c.name}
            <button
              type="button"
              aria-label={`Supprimer la couleur ${c.name}`}
              onClick={() => deleteColor.mutate(c.id)}
              className="text-ui-fg-subtle hover:text-ui-fg-error"
            >
              ×
            </button>
          </span>
        ))}
        {material.colors.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Aucune couleur — ajoutez-en une ci-dessous.
          </Text>
        )}
      </div>

      <div className="border-ui-border-base mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          aria-label="Choisir la couleur"
          className="border-ui-border-base h-9 w-10 shrink-0 cursor-pointer rounded-lg border p-1"
        />
        <Input
          placeholder="Nom (ex. Rouge feu)"
          value={colorName}
          onChange={(e) => setColorName(e.target.value)}
          maxLength={40}
          className="max-w-xs"
        />
        <Button
          variant="secondary"
          size="small"
          disabled={!colorName.trim() || !HEX_RE.test(hex) || addColor.isPending}
          onClick={() => addColor.mutate()}
        >
          Couleur
        </Button>
        {addColor.isError && (
          <Text size="small" className="w-full text-ui-fg-error">
            {(addColor.error as Error).message}
          </Text>
        )}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Filaments",
  icon: Swatch,
})

export default MaterialsPage
