import { describe, expect, it } from "vitest";
import {
  a2aDispatcher,
  agentCard,
  detectLanguage,
  keywords,
  routeText,
} from "./a2a";
import { parseItemParam } from "./cart-line";
import { apiCatalog, aiCatalog, mcpServerCard } from "./discovery";
import { RpcError, handleJsonRpc } from "./jsonrpc";
import { isMarkdownPath, prefersMarkdown } from "./markdown";
import { mcpDispatcher } from "./mcp";
import { openApiDocument } from "./openapi";
import { isAgentRoute } from "./paths";
import { SKILLS, sha256Hex, skillFile, skillsIndex } from "./skills";
import { TOOL_NAMES, toolDefinitions } from "./tools";

describe("négociation Markdown", () => {
  it("convertit seulement quand Markdown est préféré à HTML", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/html, text/markdown")).toBe(false);
    expect(prefersMarkdown("text/html;q=0.5, text/markdown;q=0.8")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
    // Accept typique d'un navigateur
    expect(
      prefersMarkdown(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
    ).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
  });

  it("ne vise que les pages localisées", () => {
    expect(isMarkdownPath("/fr")).toBe(true);
    expect(isMarkdownPath("/de/products/vase")).toBe(true);
    expect(isMarkdownPath("/")).toBe(false);
    expect(isMarkdownPath("/api/v1/products")).toBe(false);
    expect(isMarkdownPath("/french")).toBe(false);
    expect(isMarkdownPath("/fr/../api")).toBe(false);
  });
});

describe("routes agents hors next-intl", () => {
  it("reconnaît MCP, A2A et /.well-known", () => {
    expect(isAgentRoute("/mcp")).toBe(true);
    expect(isAgentRoute("/a2a")).toBe(true);
    expect(isAgentRoute("/.well-known/api-catalog")).toBe(true);
    expect(isAgentRoute("/mcpx")).toBe(false);
    expect(isAgentRoute("/fr/mcp")).toBe(false);
  });
});

describe("JSON-RPC", () => {
  const echo = async (method: string, params: unknown) => {
    if (method === "fail") throw new RpcError(-32602, "bad");
    return { method, params };
  };

  it("répond aux requêtes, ignore les notifications", async () => {
    expect(
      await handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "x" }, echo),
    ).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { method: "x", params: undefined },
    });
    expect(
      await handleJsonRpc({ jsonrpc: "2.0", method: "x" }, echo),
    ).toBeNull();
  });

  it("traduit les erreurs et gère les lots", async () => {
    const out = (await handleJsonRpc(
      [
        { jsonrpc: "2.0", id: 1, method: "fail" },
        { jsonrpc: "2.0", method: "note" },
        { foo: "bar" },
      ],
      echo,
    )) as { error?: { code: number } }[];
    expect(out).toHaveLength(2);
    expect(out[0].error?.code).toBe(-32602);
    expect(out[1].error?.code).toBe(-32600);
  });
});

describe("serveur MCP", () => {
  const dispatch = mcpDispatcher({});

  it("négocie la version et annonce les outils", async () => {
    const init = (await dispatch("initialize", {
      protocolVersion: "2025-06-18",
    })) as { protocolVersion: string; capabilities: object };
    expect(init.protocolVersion).toBe("2025-06-18");
    expect(init.capabilities).toEqual({ tools: { listChanged: false } });
    const unknown = (await dispatch("initialize", {
      protocolVersion: "1999-01-01",
    })) as { protocolVersion: string };
    expect(unknown.protocolVersion).toBe("2025-11-25");
    const list = (await dispatch("tools/list", {})) as {
      tools: { name: string; inputSchema: { type: string } }[];
    };
    expect(list.tools.map((t) => t.name)).toEqual(TOOL_NAMES);
    expect(list.tools.every((t) => t.inputSchema.type === "object")).toBe(true);
  });

  it("renvoie un résultat isError sur des arguments invalides", async () => {
    const out = (await dispatch("tools/call", {
      name: "track_order",
      arguments: { order_number: "S3D-1" },
    })) as { isError: boolean; content: { text: string }[] };
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/^invalid_arguments/);
    await expect(dispatch("tools/call", { name: "nope" })).rejects.toThrow(
      RpcError,
    );
    await expect(dispatch("resources/read", {})).rejects.toThrow(RpcError);
  });
});

describe("agent A2A", () => {
  it("comprend les demandes en texte libre", () => {
    expect(routeText("Where is order S3D-1042? jean@example.ch")).toEqual({
      skill: "track_order",
      args: { order_number: "S3D-1042", email: "jean@example.ch" },
    });
    expect(routeText("Combien coûte la livraison ?").skill).toBe(
      "get_store_info",
    );
    expect(routeText("Quelles catégories avez-vous ?").skill).toBe(
      "list_categories",
    );
    expect(routeText("un vase rouge à moins de 40 CHF")).toEqual({
      skill: "search_products",
      args: { query: "un vase rouge à moins de 40 CHF", max_price_chf: 40 },
    });
    expect(keywords("Je cherche un vase multicolore")).toEqual([
      "vase",
      "multicolore",
    ]);
    expect(detectLanguage("Je cherche un vase")).toBe("fr");
    expect(detectLanguage("Ich suche eine Vase")).toBe("de");
    expect(detectLanguage("a red vase", "it")).toBe("it");
  });

  it("répond par un message, sans tâche", async () => {
    const dispatch = a2aDispatcher({});
    const reply = (await dispatch("message/send", {
      message: {
        messageId: "m1",
        contextId: "c1",
        parts: [{ kind: "data", data: { skill: "track_order", email: "x" } }],
      },
    })) as { kind: string; contextId: string; parts: { kind: string }[] };
    expect(reply.kind).toBe("message");
    expect(reply.contextId).toBe("c1");
    expect(reply.parts.map((p) => p.kind)).toEqual(["text", "data"]);
    await expect(dispatch("tasks/get", { id: "t" })).rejects.toMatchObject({
      code: -32001,
    });
  });

  it("publie une carte v0.3 et v1.0", () => {
    const card = agentCard();
    expect(card.url).toBe("https://swiss3design.ch/a2a");
    expect(card.supportedInterfaces[0]).toMatchObject({
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    });
    expect(card.skills.map((s) => s.id)).toEqual(TOOL_NAMES);
  });
});

describe("documents de découverte", () => {
  it("décrivent les vrais points d'entrée", () => {
    const card = mcpServerCard();
    expect(card.serverInfo.name).toBe("swiss3design");
    expect(card.transport.endpoint).toBe("https://swiss3design.ch/mcp");
    expect(card.remotes[0].url).toBe(card.transport.endpoint);
    expect(card.tools).toHaveLength(toolDefinitions().length);
    expect(apiCatalog().linkset.map((l) => l.anchor)).toEqual([
      "https://swiss3design.ch/api/v1",
      "https://swiss3design.ch/mcp",
      "https://swiss3design.ch/a2a",
    ]);
    const ard = aiCatalog();
    expect(
      ard.entries.every((e) =>
        e.identifier.startsWith("urn:air:swiss3design.ch:"),
      ),
    ).toBe(true);
    expect(ard.entries.every((e) => e.representativeQueries.length >= 2)).toBe(
      true,
    );
    const openapi = openApiDocument();
    expect(Object.keys(openapi.paths)).toContain("/products/{slug}");
    expect(
      openapi.paths["/products"].get.parameters.map((p) => p.name),
    ).toContain("max_price_chf");
  });

  it("publie l'empreinte exacte de chaque SKILL.md", async () => {
    const index = await skillsIndex();
    expect(index.skills).toHaveLength(SKILLS.length);
    for (const [i, skill] of SKILLS.entries()) {
      expect(index.skills[i].digest).toBe(
        `sha256:${await sha256Hex(skillFile(skill))}`,
      );
      expect(index.skills[i].name).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("liens panier", () => {
  it("lit le paramètre item slug|quantité|variante|couleur", () => {
    expect(parseItemParam("vase-spirale|2||Rouge")).toEqual({
      slug: "vase-spirale",
      quantity: 2,
      variant: undefined,
      color: "Rouge",
    });
    expect(parseItemParam("lampe")).toEqual({
      slug: "lampe",
      quantity: 1,
      variant: undefined,
      color: undefined,
    });
    expect(parseItemParam("")).toBeNull();
  });
});
