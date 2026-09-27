import { describe, expect, it } from "vitest";
import {
  botRequestHeaders,
  directoryResponseHeaders,
  jwkThumbprint,
  loadBotKey,
  signatureBase,
} from "./web-bot-auth";

async function newKeySecret() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { secret: JSON.stringify(jwk), publicKey: pair.publicKey };
}

// Reconstruit la base depuis Signature-Input puis vérifie la signature Ed25519.
async function verify(
  headers: Record<string, string>,
  values: string[],
  publicKey: CryptoKey,
) {
  const params = headers["Signature-Input"].replace(/^sig1=/, "");
  const components = params.slice(1, params.indexOf(")")).split(" ");
  const base = signatureBase(
    components.map((id, i) => [id, values[i]]),
    params,
  );
  const signature = Uint8Array.from(
    atob(headers.Signature.replace(/^sig1=:|:$/g, "")),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    signature,
    new TextEncoder().encode(base),
  );
}

describe("Web Bot Auth", () => {
  it("calcule l'empreinte JWK de la RFC 8037 (annexe A.3)", async () => {
    expect(
      await jwkThumbprint("11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"),
    ).toBe("kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k");
  });

  it("refuse un secret absent ou mal formé", async () => {
    expect(await loadBotKey(undefined)).toBeNull();
    expect(await loadBotKey("pas du json")).toBeNull();
    expect(await loadBotKey(JSON.stringify({ kty: "RSA" }))).toBeNull();
  });

  it("signe une requête de robot vérifiable (tag web-bot-auth)", async () => {
    const { secret, publicKey } = await newKeySecret();
    const key = (await loadBotKey(secret))!;
    const headers = await botRequestHeaders(
      key,
      "https://api.indexnow.org/indexnow",
      "https://swiss3design.ch",
    );
    expect(headers["Signature-Agent"]).toBe('"https://swiss3design.ch"');
    expect(headers["Signature-Input"]).toMatch(
      /^sig1=\("@authority" "signature-agent"\);created=\d+;keyid="[\w-]+";alg="ed25519";expires=\d+;nonce="[^"]+";tag="web-bot-auth"$/,
    );
    expect(
      await verify(
        headers,
        ["api.indexnow.org", '"https://swiss3design.ch"'],
        publicKey,
      ),
    ).toBe(true);
    // Une signature ne vaut que pour son domaine.
    expect(
      await verify(
        headers,
        ["evil.example", '"https://swiss3design.ch"'],
        publicKey,
      ),
    ).toBe(false);
  });

  it("signe la réponse du répertoire pour l'hôte demandé", async () => {
    const { secret, publicKey } = await newKeySecret();
    const key = (await loadBotKey(secret))!;
    const headers = await directoryResponseHeaders(key, "swiss3design.ch");
    expect(headers["Signature-Input"]).toContain(
      'tag="http-message-signatures-directory"',
    );
    expect(headers["Signature-Input"]).toContain(`keyid="${key.keyid}"`);
    expect(await verify(headers, ["swiss3design.ch"], publicKey)).toBe(true);
  });
});
