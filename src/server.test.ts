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

test("GET /llms.txt refuses the MRR claim", async () => {
  const app = appWithFixture();
  const res = await app.request("/llms.txt");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /not MRR/i);
  assert.match(text, /null is not clean/i);
  assert.match(text, /\/v1\/intel\/sellers/);
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
