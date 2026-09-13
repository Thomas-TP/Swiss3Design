import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
export async function boundedFormData(request: Request, maxBytes: number) {
  const ceiling = maxBytes + 65536;
  const length = Number(request.headers.get("content-length"));
  if (length > ceiling || !request.body) return null;
  let size = 0;
  const stream = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size > ceiling) throw new Error("too_large");
        controller.enqueue(chunk);
      },
    }),
  );
  try {
    return await new Response(stream, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return null;
  }
}
export async function uploadOwner(create = false) {
  const jar = await cookies();
  let owner = jar.get("s3d-upload-owner")?.value;
  if (!owner && create) {
    owner = crypto.randomUUID();
    jar.set("s3d-upload-owner", owner, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
  }
  return owner;
}
export async function verifyOwnedUpload(key?: string) {
  if (!key) return true;
  if (!/^quotes\/[a-zA-Z0-9._-]+$/.test(key)) return false;
  const owner = await uploadOwner();
  if (!owner) return false;
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.R2.head(key);
  return !!object && object.customMetadata?.owner === owner;
}
