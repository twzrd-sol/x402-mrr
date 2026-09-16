import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assignRanks, laneOf, normalizeWash, parseSeller, sortLane } from "./rank.ts";
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
    assert.ok(parsed, "fixture row must parse");
    return parsed;
  });
}

test("wash tri-state: only false is ranked", () => {
  assert.equal(laneOf(true), "flagged");
  assert.equal(laneOf(false), "ranked");
  assert.equal(laneOf(null), "unevaluated");
  assert.equal(normalizeWash(undefined), null);
  assert.equal(normalizeWash("false"), null);
  assert.equal(normalizeWash(0), null);
});

test("missing wash_flagged is unevaluated, never clean", () => {
  const row = parseSeller({
    merchant: "11111111111111111111111111111111111111111111",
    unique_payers_90d: 10,
    total_tx_90d: 10,
    total_revenue_usd_90d: 99,
  });
  assert.ok(row);
  assert.equal(row.wash_flagged, null);
  assert.equal(laneOf(row.wash_flagged), "unevaluated");
});

test("fixture: flagged volume never enters ranked lane", () => {
  const ranked = assignRanks(fixtureRows());
  const rankedLane = ranked.filter((r) => r.lane === "ranked");
  const flaggedLane = ranked.filter((r) => r.lane === "flagged");
  assert.ok(rankedLane.length >= 1);
  assert.ok(flaggedLane.length >= 1);
  for (const row of rankedLane) {
    assert.equal(row.wash_flagged, false);
  }
  for (const row of flaggedLane) {
    assert.equal(row.wash_flagged, true);
  }
  const topFlagged = flaggedLane[0];
  const topRanked = rankedLane[0];
  assert.ok(topFlagged.total_revenue_usd_90d > topRanked.total_revenue_usd_90d);
  assert.equal(topRanked.merchant, "Fo26GcTnqY7vWA4gNvzVp5AfzHeeX1fYkEtfmyj4Uk67");
  assert.equal(topFlagged.merchant, "AQqnMFBwGZEoti85aTVRy8XYpKrho7GaMDx9ZB3CEeKA");
});

test("lane sort is volume desc, then payers, then merchant", () => {
  const rows: SellerRow[] = [
    {
      merchant: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      scoreable: true,
      unique_payers_90d: 2,
      total_tx_90d: 2,
      total_revenue_usd_90d: 10,
      repeat_payer_pct: null,
      captive_payer_pct: null,
      heavy_fleet_revenue_pct: null,
      days_since_last_settle: null,
      gone_dark: false,
      wash_label: null,
      wash_flagged: false,
      wash_confidence: null,
      provider_reputation_tier: null,
      demand_shape: null,
      organic_breadth_claim: null,
    },
    {
      merchant: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scoreable: true,
      unique_payers_90d: 9,
      total_tx_90d: 9,
      total_revenue_usd_90d: 10,
      repeat_payer_pct: null,
      captive_payer_pct: null,
      heavy_fleet_revenue_pct: null,
      days_since_last_settle: null,
      gone_dark: false,
      wash_label: null,
      wash_flagged: false,
      wash_confidence: null,
      provider_reputation_tier: null,
      demand_shape: null,
      organic_breadth_claim: null,
    },
  ];
  const sorted = sortLane(rows);
  assert.equal(sorted[0].merchant.startsWith("aaaa"), true);
});
