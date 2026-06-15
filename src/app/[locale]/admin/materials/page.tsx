import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { materials, products } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { MaterialsManager } from "./materials-manager";

export default async function AdminMaterialsPage() {
  await requireAdmin();
  const db = await getDb();

  const [rows, prods] = await Promise.all([
    db.select().from(materials).orderBy(asc(materials.name)),
    db.select({ material: products.material }).from(products),
  ]);

  const countByName = new Map<string, number>();
  for (const p of prods) {
    countByName.set(p.material, (countByName.get(p.material) ?? 0) + 1);
  }

  const items = rows.map((m) => ({
    id: m.id,
    name: m.name,
    count: countByName.get(m.name) ?? 0,
  }));

  return (
    <div>
      <p className="mb-5 text-sm text-soft">
        Palette de filaments proposée à la création d&apos;un produit. La
        boutique n&apos;affiche en filtre que les matières réellement utilisées
        par un produit.
      </p>
      <MaterialsManager materials={items} />
    </div>
  );
}
