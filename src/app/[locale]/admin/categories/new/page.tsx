import { requireAdmin } from "@/lib/session";
import { CategoryForm } from "../category-form";

export default async function NewCategoryPage() {
  await requireAdmin();
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Nouvelle catégorie</h2>
      <CategoryForm />
    </div>
  );
}
