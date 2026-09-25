import { headers } from "next/headers";
import { getAuth } from "./auth";
import { isSessionFresh } from "./session-freshness";

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

export async function requireFreshAdmin() {
  const session = await requireAdmin();
  if (!isSessionFresh(session.session.createdAt)) {
    throw new Error("reauth_required");
  }
  return session;
}
