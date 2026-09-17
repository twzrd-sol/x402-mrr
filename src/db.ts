import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { roundUsd } from "./rank.ts";
import type { RankedSeller } from "./types.ts";

export interface SnapshotMeta {
  id: number;
  fetchedAt: string;
  window: string | null;
  scoreVersion: string | null;
  ranking: string | null;
  sellerCount: number;
  truncated: number;
}

export function openDb(dbPath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL,
      window TEXT,
      score_version TEXT,
      ranking TEXT,
      seller_count INTEGER NOT NULL,
      truncated INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sellers (
      merchant TEXT PRIMARY KEY,
      snapshot_id INTEGER NOT NULL,
      lane TEXT NOT NULL,
      rank_in_lane INTEGER NOT NULL,
      unique_payers_90d INTEGER NOT NULL,
      total_tx_90d INTEGER NOT NULL,
      total_revenue_usd_90d REAL NOT NULL,
      repeat_payer_pct REAL,
      captive_payer_pct REAL,
      heavy_fleet_revenue_pct REAL,
      days_since_last_settle REAL,
      gone_dark INTEGER NOT NULL,
      wash_label TEXT,
      wash_flagged INTEGER,
      wash_confidence TEXT,
      provider_reputation_tier TEXT,
      demand_shape TEXT,
      organic_breadth_claim INTEGER,
      scoreable INTEGER NOT NULL,
      growth_pct REAL,
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
    );
    CREATE INDEX IF NOT EXISTS sellers_lane_rank ON sellers(lane, rank_in_lane);
  `);
  return db;
}

function washToInt(v: boolean | null): number | null {
  if (v === true) return 1;
  if (v === false) return 0;
  return null;
}

function washFromInt(v: unknown): boolean | null {
  if (v === 1) return true;
  if (v === 0) return false;
  return null;
}

export function latestSnapshot(db: DatabaseSync): SnapshotMeta | null {
  const row = db.prepare(
    "SELECT id, fetched_at, window, score_version, ranking, seller_count, truncated FROM snapshots ORDER BY id DESC LIMIT 1",
  ).get() as
    | {
        id: number;
        fetched_at: string;
        window: string | null;
        score_version: string | null;
        ranking: string | null;
        seller_count: number;
        truncated: number;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    fetchedAt: row.fetched_at,
    window: row.window,
    scoreVersion: row.score_version,
    ranking: row.ranking,
    sellerCount: row.seller_count,
    truncated: row.truncated,
  };
}

export function currentVolumes(db: DatabaseSync): Map<string, number> {
  const latest = latestSnapshot(db);
  if (!latest) return new Map();
  const map = new Map<string, number>();
  const rows = db.prepare(
    "SELECT merchant, total_revenue_usd_90d FROM sellers WHERE snapshot_id = ?",
  ).all(latest.id) as Array<{ merchant: string; total_revenue_usd_90d: number }>;
  for (const r of rows) map.set(r.merchant, r.total_revenue_usd_90d);
  return map;
}

export function replaceSellers(
  db: DatabaseSync,
  ranked: readonly RankedSeller[],
  meta: {
    fetchedAt: string;
    window: string | null;
    scoreVersion: string | null;
    ranking: string | null;
    truncated: boolean;
  },
): number {
  const insertSnap = db.prepare(
    "INSERT INTO snapshots (fetched_at, window, score_version, ranking, seller_count, truncated) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertSeller = db.prepare(`
    INSERT INTO sellers (
      merchant, snapshot_id, lane, rank_in_lane,
      unique_payers_90d, total_tx_90d, total_revenue_usd_90d,
      repeat_payer_pct, captive_payer_pct, heavy_fleet_revenue_pct,
      days_since_last_settle, gone_dark, wash_label, wash_flagged,
      wash_confidence, provider_reputation_tier, demand_shape,
      organic_breadth_claim, scoreable, growth_pct
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM sellers");
    insertSnap.run(
      meta.fetchedAt,
      meta.window,
      meta.scoreVersion,
      meta.ranking,
      ranked.length,
      meta.truncated ? 1 : 0,
    );
    const snap = latestSnapshot(db);
    if (!snap) throw new Error("snapshot insert failed");
    for (const row of ranked) {
      insertSeller.run(
        row.merchant,
        snap.id,
        row.lane,
        row.rank_in_lane,
        row.unique_payers_90d,
        row.total_tx_90d,
        row.total_revenue_usd_90d,
        row.repeat_payer_pct,
        row.captive_payer_pct,
        row.heavy_fleet_revenue_pct,
        row.days_since_last_settle,
        row.gone_dark ? 1 : 0,
        row.wash_label,
        washToInt(row.wash_flagged),
        row.wash_confidence,
        row.provider_reputation_tier,
        row.demand_shape,
        row.organic_breadth_claim === null ? null : row.organic_breadth_claim ? 1 : 0,
        row.scoreable ? 1 : 0,
        row.growth_pct,
      );
    }
    db.exec("COMMIT");
    return snap.id;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function toRanked(row: Record<string, unknown>): RankedSeller {
  return {
    merchant: String(row.merchant),
    scoreable: row.scoreable === 1,
    unique_payers_90d: Number(row.unique_payers_90d),
    total_tx_90d: Number(row.total_tx_90d),
    total_revenue_usd_90d: Number(row.total_revenue_usd_90d),
    repeat_payer_pct: row.repeat_payer_pct === null ? null : Number(row.repeat_payer_pct),
    captive_payer_pct: row.captive_payer_pct === null ? null : Number(row.captive_payer_pct),
    heavy_fleet_revenue_pct:
      row.heavy_fleet_revenue_pct === null ? null : Number(row.heavy_fleet_revenue_pct),
    days_since_last_settle:
      row.days_since_last_settle === null ? null : Number(row.days_since_last_settle),
    gone_dark: row.gone_dark === 1,
    wash_label: row.wash_label === null ? null : String(row.wash_label),
    wash_flagged: washFromInt(row.wash_flagged),
    wash_confidence: row.wash_confidence === null ? null : String(row.wash_confidence),
    provider_reputation_tier:
      row.provider_reputation_tier === null ? null : String(row.provider_reputation_tier),
    demand_shape: row.demand_shape === null ? null : String(row.demand_shape),
    organic_breadth_claim:
      row.organic_breadth_claim === null ? null : row.organic_breadth_claim === 1,
    lane: row.lane as RankedSeller["lane"],
    rank_in_lane: Number(row.rank_in_lane),
    growth_pct: row.growth_pct === null ? null : Number(row.growth_pct),
  };
}

export function listLane(
  db: DatabaseSync,
  lane: RankedSeller["lane"],
  limit: number,
): RankedSeller[] {
  const rows = db.prepare(
    "SELECT * FROM sellers WHERE lane = ? ORDER BY rank_in_lane ASC LIMIT ?",
  ).all(lane, limit) as Array<Record<string, unknown>>;
  return rows.map(toRanked);
}

export function getSeller(db: DatabaseSync, merchant: string): RankedSeller | null {
  const row = db.prepare("SELECT * FROM sellers WHERE merchant = ?").get(merchant) as
    | Record<string, unknown>
    | undefined;
  return row ? toRanked(row) : null;
}

export function laneStats(db: DatabaseSync): {
  sellers: number;
  ranked: number;
  unevaluated: number;
  flagged: number;
  ranked_volume_usd_90d: number;
  unevaluated_volume_usd_90d: number;
  flagged_volume_usd_90d: number;
  gone_dark: number;
  overlay_full: number;
  overlay_partial: number;
  payers_leader_lane: RankedSeller["lane"] | null;
} {
  const counts = db.prepare(
    `SELECT
       COUNT(*) AS sellers,
       SUM(CASE WHEN lane = 'ranked' THEN 1 ELSE 0 END) AS ranked,
       SUM(CASE WHEN lane = 'unevaluated' THEN 1 ELSE 0 END) AS unevaluated,
       SUM(CASE WHEN lane = 'flagged' THEN 1 ELSE 0 END) AS flagged,
       COALESCE(SUM(CASE WHEN lane = 'ranked' THEN total_revenue_usd_90d ELSE 0 END), 0) AS ranked_vol,
       COALESCE(SUM(CASE WHEN lane = 'unevaluated' THEN total_revenue_usd_90d ELSE 0 END), 0) AS uneval_vol,
       COALESCE(SUM(CASE WHEN lane = 'flagged' THEN total_revenue_usd_90d ELSE 0 END), 0) AS flagged_vol,
       SUM(CASE WHEN gone_dark = 1 THEN 1 ELSE 0 END) AS gone_dark,
       SUM(CASE WHEN wash_confidence = 'full' THEN 1 ELSE 0 END) AS overlay_full,
       SUM(CASE WHEN wash_confidence = 'partial_inbound_only' THEN 1 ELSE 0 END) AS overlay_partial
     FROM sellers`,
  ).get() as Record<string, number>;
  return {
    sellers: Number(counts.sellers ?? 0),
    ranked: Number(counts.ranked ?? 0),
    unevaluated: Number(counts.unevaluated ?? 0),
    flagged: Number(counts.flagged ?? 0),
    ranked_volume_usd_90d: roundUsd(Number(counts.ranked_vol ?? 0)),
    unevaluated_volume_usd_90d: roundUsd(Number(counts.uneval_vol ?? 0)),
    flagged_volume_usd_90d: roundUsd(Number(counts.flagged_vol ?? 0)),
    gone_dark: Number(counts.gone_dark ?? 0),
    overlay_full: Number(counts.overlay_full ?? 0),
    overlay_partial: Number(counts.overlay_partial ?? 0),
    payers_leader_lane: (() => {
      const row = db.prepare(
        "SELECT lane FROM sellers ORDER BY unique_payers_90d DESC, merchant ASC LIMIT 1",
      ).get() as { lane?: string } | undefined;
      const lane = row?.lane;
      if (lane === "ranked" || lane === "unevaluated" || lane === "flagged") return lane;
      return null;
    })(),
  };
}

export function ingestRows(
  db: DatabaseSync,
  ranked: readonly RankedSeller[],
  meta: {
    fetchedAt: string;
    window: string | null;
    scoreVersion: string | null;
    ranking: string | null;
    truncated: boolean;
  },
): number {
  return replaceSellers(db, ranked, meta);
}
