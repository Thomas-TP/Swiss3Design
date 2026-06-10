"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";

const schema = z.object({
  email: z.email(),
  description: z.string().min(10).max(4000),
  material: z.string().max(100).optional(),
  colors: z.string().max(200).optional(),
  dimensions: z.string().max(200).optional(),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
});

export interface QuoteFormState {
  status: "idle" | "success" | "error";
}

export async function submitQuoteRequest(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    description: formData.get("description"),
    material: (formData.get("material") as string) || undefined,
    colors: (formData.get("colors") as string) || undefined,
    dimensions: (formData.get("dimensions") as string) || undefined,
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  try {
    const session = await getServerSession();
    const db = await getDb();
    await db.insert(quoteRequests).values({
      ...parsed.data,
      customerId: session?.user.id ?? null,
    });
    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}
