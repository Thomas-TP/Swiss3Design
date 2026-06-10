import { headers } from "next/headers";
import { getAuth } from "./auth";

export async function getServerSession() {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
}

export async function requireAdmin() {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    throw new Error("unauthorized");
  }
  return session;
}
