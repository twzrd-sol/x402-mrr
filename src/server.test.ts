import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { parseSeller } from "./rank.ts";
import { createApp } from "./server.ts";
import { createStore } from "./store.ts";
import type { Board, SellerRow } from "./types.ts";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "fixtures",
  "sellers.json",
);

function fixtureRows(): SellerRow[] {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as { sellers: unknown[] };
  return raw.sellers.map((row) => {
    const parsed = parseSeller(row);
    assert.ok(parsed);
    return parsed;
  });
}

function appWithFixture() {
  const db = openDb(":memory:");
  const config = loadConfig();
  const store = createStore(db, config);
  store.load(fixtureRows());
  return createApp(store, config);
}

test("GET /api/leaderboard keeps flagged volume out of ranked", async () => {
  const app = appWithFixture();
  const res = await app.request("/api/leaderboard?limit=10");
  assert.equal(res.status, 200);
  const body = (await res.json()) as Board;
  assert.equal(body.ranked.rows.every((r) => r.wash_flagged === false), true);
  const flaggedMerchants = new Set(body.flagged.rows.map((r) => r.merchant));
  for (const row of body.ranked.rows) {
    assert.equal(flaggedMerchants.has(row.merchant), false);
  }
  assert.ok(body.flagged.volume_usd_90d > body.ranked.volume_usd_90d);
});

test("GET /health identifies Settled, not MRR", async () => {
  const app = appWithFixture();
  const res = await app.request("/health");
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    product: string;
    metric: string;
    not: string;
    bind: string;
    port: number;
  };
  assert.equal(body.product, "settled");
  assert.equal(body.metric, "observed_settled_usd_90d");
  assert.equal(body.not, "mrr");
  assert.equal(body.bind, "127.0.0.1");
  assert.equal(body.port, 4040);
});

test("GET /llms.txt refuses the MRR claim", async () => {
  const app = appWithFixture();
  const res = await app.request("/llms.txt");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /not MRR/i);
  assert.match(text, /null is not clean/i);
  assert.match(text, /\/v1\/intel\/sellers/);
  assert.match(text, /not a discount/i);
  assert.match(text, /sliding scoring window/i);
  assert.match(text, /inbound-only/i);
  assert.match(text, /unique payers with wash orthogonal/i);
});

test("GET /app.js forbids shared cache and keeps overlay copy", async () => {
  const app = appWithFixture();
  const res = await app.request("/app.js");
  assert.equal(res.status, 200);
  const cc = res.headers.get("cache-control") ?? "";
  assert.match(cc, /no-store/i);
  const cdn = res.headers.get("cdn-cache-control") ?? "";
  assert.match(cdn, /no-store/i);
  const text = await res.text();
  assert.match(text, /full overlay/);
  assert.match(text, /inbound only|partial_inbound_only/);
  assert.match(text, /not MRR/);
});

test("GET /app.css forbids shared cache", async () => {
  const app = appWithFixture();
  const res = await app.request("/app.css");
  assert.equal(res.status, 200);
  const cc = res.headers.get("cache-control") ?? "";
  assert.match(cc, /no-store/i);
});

test("POST /mcp tools/call seller", async () => {
  const app = appWithFixture();
  const res = await app.request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "seller",
        arguments: { wallet: "Fo26GcTnqY7vWA4gNvzVp5AfzHeeX1fYkEtfmyj4Uk67" },
      },
    }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
  const row = JSON.parse(body.result.content[0].text) as { lane: string; wash_flagged: boolean };
  assert.equal(row.lane, "ranked");
  assert.equal(row.wash_flagged, false);
});
