import { PUBLIC_CORS } from "@/lib/agent/config";
import { SKILLS, skillFile } from "@/lib/agent/skills";

// SKILL.md d'une skill listée dans index.json (octets identiques à ceux dont
// l'index publie l'empreinte SHA-256).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const skill = SKILLS.find((s) => s.name === name);
  if (!skill) return new Response("Not found", { status: 404 });
  return new Response(skillFile(skill), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...PUBLIC_CORS,
    },
  });
}
