"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

// setPassword est un endpoint Better Auth server-only (pas exposé au client) :
// il permet à un compte connecté uniquement via OAuth (Google…) de définir un
// premier mot de passe, sans en connaître un existant à fournir.
export async function setPasswordAction(
  newPassword: string,
): Promise<{ success: true } | { error: string }> {
  if (newPassword.length < 8) {
    return { error: "too_short" };
  }
  const auth = await getAuth();
  try {
    await auth.api.setPassword({
      headers: await headers(),
      body: { newPassword },
    });
    return { success: true };
  } catch {
    return { error: "failed" };
  }
}
