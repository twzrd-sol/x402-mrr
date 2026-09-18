import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { createApp } from "./server.ts";
import { createStore } from "./store.ts";
import { parseSummary, renderDeliveryHtml } from "./delivery.ts";

const live = {
  version: "delivery_probes_v1",
  n_delivered: 2, m_attempted: 3, not_attempted: 1, latest_probe_unix: 1789717964,
  honesty: { n: "x" }, reproduce_sql: "SELECT 1",
  rows: [
    { resource_url: "https://a.example/<script>alert(1)</script>", outcome: "delivered", failure_class: null, http_status: 200, settlement_tx: "5HGqCiQQtx", probed_at_unix: 1789717964 },
    { resource_url: "https://b.example/ok", outcome: "delivered", failure_class: null, http_status: 200, settlement_tx: "9XM3SeQatx", probed_at_unix: 1789717964 },
    { resource_url: "https://c.example/405", outcome: "failed", failure_class: "method_not_allowed", http_status: 405, settlement_tx: null, probed_at_unix: 1789717964 },
    { resource_url: "https://d.example/v1", outcome: "not_attempted", failure_class: "client_unsupported", http_status: null, settlement_tx: null, probed_at_unix: 1789717964 },
  ],
};

function app(fetchImpl: typeof fetch) {
  const config = loadConfig();
  const store = createStore(openDb(":memory:"), config);
  return createApp(store, config, "public", { fetchImpl, now: () => 1789718000000 });
}

test("parseSummary recounts N and M from rows and never lets a relay inflate N", () => {
  const s = parseSummary({ ...live, n_delivered: 99 }, "intel", "t");
  assert.ok(s);
  assert.equal(s.n_delivered, 2);
  assert.equal(s.m_attempted, 3);
  assert.equal(s.not_attempted, 1);
  assert.equal(parseSummary({ nope: 1 }, "intel", "t"), null);
});

test("GET /delivery.json relays live intel and GET /delivery renders escaped rows", async () => {
  let calls = 0;
  const a = app((async () => { calls += 1; return new Response(JSON.stringify(live), { status: 200 }); }) as typeof fetch);
  const j = await a.request("/delivery.json");
  assert.equal(j.status, 200);
  const body = (await j.json()) as { source: string; n_delivered: number; m_attempted: number; rows: unknown[] };
  assert.equal(body.source, "intel");
  assert.equal(body.n_delivered, 2);
  assert.equal(body.m_attempted, 3);
  assert.equal(body.rows.length, 4);
  const h = await a.request("/delivery");
  assert.equal(h.status, 200);
  const html = await h.text();
  assert.match(html, /<h1>2 of 3 live x402 sellers deliver to a paying client<\/h1>/);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "resource URLs are escaped");
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("method_not_allowed"));
  assert.equal(calls, 1, "second route hit is served from the 5 min cache");
});

test("intel outage falls back to the committed snapshot and says so", async () => {
  const a = app((async () => new Response("nope", { status: 404 })) as typeof fetch);
  const j = await a.request("/delivery.json");
  const body = (await j.json()) as { source: string; error?: string; n_delivered: number; m_attempted: number; rows: unknown[] };
  assert.equal(body.source, "snapshot");
  assert.equal(body.error, "intel_summary_http_404");
  assert.equal(body.n_delivered, 18);
  assert.equal(body.m_attempted, 41);
  assert.equal(body.rows.length, 43);
  const html = await (await a.request("/delivery")).text();
  assert.match(html, /18 of 41 live x402 sellers/);
  assert.match(html, /committed snapshot/);
});

test("renderDeliveryHtml never emits raw seller strings", () => {
  const s = parseSummary(live, "intel", "t");
  assert.ok(s);
  const html = renderDeliveryHtml({ ...s, rows: [{ ...s.rows[2], failure_class: "<img src=x onerror=1>" }] });
  assert.ok(!html.includes("<img src=x"));
});
