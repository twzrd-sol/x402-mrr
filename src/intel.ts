import { INTEL_SELLERS_PATH, USER_AGENT } from "./honesty.ts";
import { parseSeller } from "./rank.ts";
import type { SellerRow } from "./types.ts";

export interface FetchResult {
  rows: SellerRow[];
  window: string | null;
  scoreVersion: string | null;
  ranking: string | null;
  fetchedAt: string;
  pages: number;
  truncated: boolean;
  dropped: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSellers(opts: {
  base: string;
  pageLimit: number;
  maxPages: number;
  pageDelayMs: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const rows: SellerRow[] = [];
  let offset = 0;
  let pages = 0;
  let window: string | null = null;
  let scoreVersion: string | null = null;
  let ranking: string | null = null;
  let truncated = false;
  let dropped = 0;
  let hasMore = true;

  while (hasMore && pages < opts.maxPages) {
    const url = `${opts.base}${INTEL_SELLERS_PATH}?limit=${opts.pageLimit}&offset=${offset}`;
    const res = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
    });
    if (!res.ok) {
      throw new Error(`intel sellers ${res.status} at offset ${offset}`);
    }
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object") {
      throw new Error("intel sellers returned a non-object");
    }
    const obj = body as Record<string, unknown>;
    if (typeof obj.window === "string") window = obj.window;
    if (typeof obj.score_version === "string") scoreVersion = obj.score_version;
    if (typeof obj.ranking === "string") ranking = obj.ranking;
    const list = Array.isArray(obj.sellers) ? obj.sellers : [];
    for (const item of list) {
      const parsed = parseSeller(item);
      if (parsed) rows.push(parsed);
      else dropped += 1;
    }
    pages += 1;
    const pagination =
      obj.pagination !== null && typeof obj.pagination === "object"
        ? (obj.pagination as Record<string, unknown>)
        : {};
    hasMore = pagination.has_more === true;
    if (hasMore) {
      const next = Number(pagination.next_offset);
      if (!Number.isInteger(next) || next <= offset) {
        throw new Error("intel sellers pagination did not advance");
      }
      offset = next;
      if (pages < opts.maxPages) await sleep(opts.pageDelayMs);
    }
  }
  if (hasMore) truncated = true;
  return {
    rows,
    window,
    scoreVersion,
    ranking,
    fetchedAt: new Date().toISOString(),
    pages,
    truncated,
    dropped,
  };
}
