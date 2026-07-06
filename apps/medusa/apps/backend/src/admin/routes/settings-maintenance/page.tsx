import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CogSixTooth, Trash } from "@medusajs/icons"
import { Container, Heading, Text, Button, Badge } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"

type Report = { deleted: number; filesCleared: number }

const SettingsMaintenancePage = () => {
  const runMaintenance = useMutation({
    mutationFn: async () => {
      const res = await fetch("/admin/maintenance", { method: "POST", credentials: "include" })
      if (!res.ok) throw new Error("Échec du nettoyage.")
      return (await res.json()) as Report
    },
  })

  return (
    <Container>
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Réglages de la boutique</Heading>
      </div>

      <div className="border-ui-border-base border-t px-6 py-6">
        <Text weight="plus" className="mb-1">
          Frais de port
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Gérés nativement par Medusa via les options d'expédition et leurs règles de prix
          (franco de port dès 60 CHF déjà configuré) — voir{" "}
          <a href="/app/settings/locations" className="text-ui-fg-interactive">
            Réglages → Emplacements & expédition
          </a>
          . Aucun réglage supplémentaire nécessaire ici.
        </Text>
      </div>

      <div className="border-ui-border-base border-t px-6 py-6">
        <Text weight="plus" className="mb-1">
          Maintenance des données
        </Text>
        <Text size="small" className="text-ui-fg-subtle mb-4">
          Applique la rétention RGPD (2 ans) sur les devis : les devis non finalisés de plus de 2
          ans sont supprimés, les devis payés/en production/terminés gardent leur ligne mais
          perdent leur fichier 3D. S'exécute aussi automatiquement chaque nuit à 3h.
        </Text>
        <Button
          variant="secondary"
          disabled={runMaintenance.isPending}
          onClick={() => runMaintenance.mutate()}
        >
          <Trash />
          {runMaintenance.isPending ? "Nettoyage…" : "Lancer le nettoyage"}
        </Button>
        {runMaintenance.data && (
          <div className="mt-4 flex gap-2">
            <Badge color="green">{runMaintenance.data.deleted} devis supprimé(s)</Badge>
            <Badge color="green">{runMaintenance.data.filesCleared} fichier(s) nettoyé(s)</Badge>
          </div>
        )}
        {runMaintenance.isError && (
          <Text size="small" className="text-ui-fg-error mt-3">
            Échec du nettoyage. Réessayez.
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Réglages",
  icon: CogSixTooth,
})

export default SettingsMaintenancePage
