import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getMaterialsWithColors } from "@/db/queries";
import { requireAdmin } from "@/lib/session";
import { MaterialsManager } from "./materials-manager";

export default async function AdminMaterialsPage() {
  await requireAdmin();
  const db = await getDb();

  const [mats, prods] = await Promise.all([
    getMaterialsWithColors(),
    db.select({ material: products.material }).from(products),
  ]);

  const countByName = new Map<string, number>();
  for (const p of prods) {
    countByName.set(p.material, (countByName.get(p.material) ?? 0) + 1);
  }

  const items = mats.map((m) => ({
    id: m.id,
    name: m.name,
    count: countByName.get(m.name) ?? 0,
    colors: m.colors,
  }));

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">
        Filaments &amp; couleurs
      </h2>
      <p className="mb-5 max-w-2xl text-sm text-soft">
        Vos filaments et, pour chacun, sa palette de couleurs. Les couleurs
        définies ici sont proposées à la création d&apos;un produit, puis
        affichées en pastilles sélectionnables dans la boutique.
      </p>
      <MaterialsManager materials={items} />
    </div>
  );
}
