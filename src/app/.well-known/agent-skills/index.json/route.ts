import { jsonResponse, preflight } from "@/lib/agent/config";
import { skillsIndex } from "@/lib/agent/skills";

// Index des skills pour agents (Agent Skills Discovery RFC v0.2.0).
export async function GET() {
  return jsonResponse(await skillsIndex(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export const OPTIONS = preflight;
