import { readFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Store } from "./store.ts";
import { handleMcp } from "./mcp.ts";
import { renderLlmsTxt } from "./llms.ts";
import type { Config } from "./config.ts";

function clampLimit(raw: string | undefined, fallback: number): number {
  const n = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

export function createApp(store: Store, config: Config, publicDir = "public"): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    const h = store.health();
    return c.json({
      ...h,
      bind: config.bind,
      port: config.port,
      intel_base: config.intelBase,
      product: "settled",
      metric: "observed_settled_usd_90d",
      not: "mrr",
    });
  });

  app.get("/api/leaderboard", (c) => {
    const limit = clampLimit(c.req.query("limit"), config.publicLimit);
    return c.json(store.board(limit));
  });

  app.get("/api/seller/:wallet", (c) => {
    const wallet = c.req.param("wallet");
    const row = store.seller(wallet);
    if (!row) return c.json({ error: "not_in_snapshot", wallet }, 404);
    return c.json({
      seller: row,
      links: {
        merchant_card: `${config.intelBase}/v1/intel/merchant_card/${wallet}`,
        preflight: `${config.intelBase}/v1/intel/preflight`,
        intel_sellers: `${config.intelBase}/v1/intel/sellers`,
      },
    });
  });

  app.get("/llms.txt", (c) => {
    const body = renderLlmsTxt(store.board(10));
    return c.text(body, 200, { "content-type": "text/plain; charset=utf-8" });
  });

  app.get("/.well-known/mcp.json", (c) =>
    c.json({
      name: "x402-mrr",
      description: "Observed x402 settled volume by wash lane. Not MRR.",
      endpoint: "/mcp",
    }),
  );

  app.post("/mcp", async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json(handleMcp(store, body));
  });

  const indexFile = path.join(publicDir, "index.html");
  app.get("/", async (c) => c.html(await readFile(indexFile, "utf8")));
  app.get("/seller/:wallet", async (c) => c.html(await readFile(indexFile, "utf8")));

  app.use("/*", serveStatic({ root: publicDir }));

  return app;
}
