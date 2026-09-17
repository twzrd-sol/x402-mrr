import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { parseSeller } from "./rank.ts";
import { createStore } from "./store.ts";
import type { SellerRow } from "./types.ts";

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

test("second ingest computes growth against the prior snapshot", () => {
  const db = openDb(":memory:");
  const store = createStore(db, loadConfig());
  const rows = fixtureRows();
  store.load(rows, { fetchedAt: "2026-09-01T00:00:00Z" });
  const first = store.seller("Fo26GcTnqY7vWA4gNvzVp5AfzHeeX1fYkEtfmyj4Uk67");
  assert.ok(first);
  assert.equal(first.growth_pct, null);

  const next = rows.map((row) =>
    row.merchant === first.merchant
      ? { ...row, total_revenue_usd_90d: row.total_revenue_usd_90d * 2 }
      : row,
  );
  store.load(next, { fetchedAt: "2026-09-02T00:00:00Z" });
  const second = store.seller(first.merchant);
  assert.ok(second);
  assert.ok(second.growth_pct !== null);
  assert.ok(Math.abs((second.growth_pct ?? 0) - 100) < 0.01);
});

test("board stats split the three wash lanes", () => {
  const db = openDb(":memory:");
  const store = createStore(db, loadConfig());
  const rows = fixtureRows();
  store.load(rows);
  const board = store.board(50);
  assert.equal(board.stats.ranked + board.stats.unevaluated + board.stats.flagged, board.stats.sellers);
  assert.equal(board.ranked.rows.every((r) => r.wash_flagged === false), true);
  assert.equal(board.flagged.rows.every((r) => r.wash_flagged === true), true);
  assert.equal(board.unevaluated.rows.every((r) => r.wash_flagged === null), true);
  assert.equal(board.honesty.metric.includes("MRR"), true);
  const full = rows.filter((r) => r.wash_confidence === "full").length;
  const partial = rows.filter((r) => r.wash_confidence === "partial_inbound_only").length;
  assert.equal(board.stats.overlay_full, full);
  assert.equal(board.stats.overlay_partial, partial);
  assert.equal(board.stats.overlay_full + board.stats.overlay_partial, board.stats.sellers);
});
