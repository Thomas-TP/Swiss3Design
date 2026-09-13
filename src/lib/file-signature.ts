// Contrôle borné du conteneur avant stockage ; ce n'est pas un antivirus.
export async function hasExpectedSignature(
  file: Blob,
  extension: string,
): Promise<boolean> {
  if (!file.size) return false;
  const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const prefix = (...values: number[]) =>
    values.every((v, i) => bytes[i] === v);
  switch (extension.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return prefix(0xff, 0xd8, 0xff);
    case "png":
      return prefix(137, 80, 78, 71, 13, 10, 26, 10);
    case "webp":
      return text.slice(0, 4) === "RIFF" && text.slice(8, 12) === "WEBP";
    case "avif":
      return text.slice(4, 8) === "ftyp" && /avif|avis/.test(text.slice(8, 64));
    case "glb":
      return (
        bytes.length >= 12 &&
        text.slice(0, 4) === "glTF" &&
        new DataView(bytes.buffer).getUint32(4, true) === 2 &&
        new DataView(bytes.buffer).getUint32(8, true) === file.size
      );
    case "stl": {
      if (bytes.length >= 84) {
        const count = new DataView(bytes.buffer).getUint32(80, true);
        if (count > 0 && 84 + count * 50 === file.size) return true;
      }
      return (
        /^\s*solid\b/i.test(text) &&
        /\bfacet\s+normal\b/i.test(text) &&
        /\bvertex\s/i.test(text)
      );
    }
    case "3mf":
      return prefix(0x50, 0x4b, 0x03, 0x04);
    case "step":
    case "stp":
      return /^\s*ISO-10303-21;/i.test(text);
    case "obj":
      return /^(?:v|vn|vt)\s+[-+\d.]/m.test(text) && !text.includes("\u0000");
    default:
      return false;
  }
}
