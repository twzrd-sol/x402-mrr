import type { DatabaseSync } from "node:sqlite";
import { HONESTY, INTEL_SELLERS_PATH, WINDOW } from "./honesty.ts";
import { assignRanks } from "./rank.ts";
import {
  currentVolumes,
  getSeller,
  ingestRows,
  laneStats,
  latestSnapshot,
  listLane,
} from "./db.ts";
import { fetchSellers } from "./intel.ts";
import type { Config } from "./config.ts";
import type { Board, Lane, RankedSeller, SellerRow } from "./types.ts";

export interface Store {
  refresh(): Promise<{ sellers: number; pages: number; truncated: boolean }>;
  load(rows: readonly SellerRow[], meta?: Partial<{ fetchedAt: string; window: string; scoreVersion: string; ranking: string; truncated: boolean }>): void;
  board(limit: number): Board;
  seller(wallet: string): RankedSeller | null;
  health(): {
    ok: boolean;
    sellers: number;
    fetched_at: string | null;
    truncated: boolean;
  };
}

function laneBoard(db: DatabaseSync, lane: Lane, limit: number, stats: ReturnType<typeof laneStats>) {
  const volumeKey =
    lane === "ranked"
      ? stats.ranked_volume_usd_90d
      : lane === "unevaluated"
        ? stats.unevaluated_volume_usd_90d
        : stats.flagged_volume_usd_90d;
  const countKey =
    lane === "ranked" ? stats.ranked : lane === "unevaluated" ? stats.unevaluated : stats.flagged;
  return {
    lane,
    count: countKey,
    volume_usd_90d: volumeKey,
    rows: listLane(db, lane, limit),
  };
}

export function createStore(db: DatabaseSync, config: Config): Store {
  return {
    load(rows, meta = {}) {
      const prev = currentVolumes(db);
      const ranked = assignRanks(rows, prev);
      ingestRows(db, ranked, {
        fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
        window: meta.window ?? WINDOW,
        scoreVersion: meta.scoreVersion ?? null,
        ranking: meta.ranking ?? null,
        truncated: meta.truncated ?? false,
      });
    },
    async refresh() {
      const fetched = await fetchSellers({
        base: config.intelBase,
        pageLimit: config.pageLimit,
        maxPages: config.maxPages,
        pageDelayMs: config.pageDelayMs,
      });
      this.load(fetched.rows, {
        fetchedAt: fetched.fetchedAt,
        window: fetched.window ?? WINDOW,
        scoreVersion: fetched.scoreVersion ?? undefined,
        ranking: fetched.ranking ?? undefined,
        truncated: fetched.truncated,
      });
      return {
        sellers: fetched.rows.length,
        pages: fetched.pages,
        truncated: fetched.truncated,
      };
    },
    board(limit: number) {
      const cap = Math.max(1, Math.min(limit, 200));
      const snap = latestSnapshot(db);
      const stats = laneStats(db);
      return {
        honesty: HONESTY,
        source: {
          intel_base: config.intelBase,
          sellers_path: INTEL_SELLERS_PATH,
          window: snap?.window ?? WINDOW,
          score_version: snap?.scoreVersion ?? null,
          fetched_at: snap?.fetchedAt ?? null,
          truncated: snap?.truncated === 1,
        },
        stats,
        ranked: laneBoard(db, "ranked", cap, stats),
        unevaluated: laneBoard(db, "unevaluated", cap, stats),
        flagged: laneBoard(db, "flagged", cap, stats),
      };
    },
    seller(wallet: string) {
      return getSeller(db, wallet);
    },
    health() {
      const snap = latestSnapshot(db);
      const stats = laneStats(db);
      return {
        ok: true,
        sellers: stats.sellers,
        fetched_at: snap?.fetchedAt ?? null,
        truncated: snap?.truncated === 1,
      };
    },
  };
}
