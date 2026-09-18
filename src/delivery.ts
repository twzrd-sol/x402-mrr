// N of M: live x402 sellers that delivered to a REAL paying client on their
// latest house probe. Source of truth is intel's x402_delivery_probes via
// GET /v1/intel/delivery-probes/summary. This module only relays it (cached),
// escapes it, and falls back to a committed snapshot when intel cannot answer.
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DELIVERY_SUMMARY_PATH = "/v1/intel/delivery-probes/summary";
export const DELIVERY_CACHE_MS = 5 * 60 * 1000;

export interface ProbeRow {
  resource_url: string;
  outcome: "delivered" | "failed" | "not_attempted";
  failure_class: string | null;
  http_status: number | null;
  settlement_tx: string | null;
  probed_at_unix: number | null;
}

export interface DeliverySummary {
  version: string;
  source: "intel" | "snapshot";
  n_delivered: number;
  m_attempted: number;
  not_attempted: number;
  latest_probe_unix: number | null;
  honesty: Record<string, string>;
  reproduce_sql: string | null;
  rows: ProbeRow[];
  fetched_at: string;
  error?: string;
}

function asRow(v: unknown): ProbeRow | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const url = o.resource_url;
  const outcome = o.outcome;
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
  if (outcome !== "delivered" && outcome !== "failed" && outcome !== "not_attempted") return null;
  return {
    resource_url: url,
    outcome,
    failure_class: typeof o.failure_class === "string" ? o.failure_class : null,
    http_status: typeof o.http_status === "number" ? o.http_status : null,
    settlement_tx: typeof o.settlement_tx === "string" ? o.settlement_tx : null,
    probed_at_unix: typeof o.probed_at_unix === "number" ? o.probed_at_unix : null,
  };
}

export function parseSummary(body: unknown, source: "intel" | "snapshot", fetchedAt: string): DeliverySummary | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const n = Number(o.n_delivered);
  const m = Number(o.m_attempted);
  if (!Number.isFinite(n) || !Number.isFinite(m)) return null;
  const rows = (Array.isArray(o.rows) ? o.rows : []).map(asRow).filter((r): r is ProbeRow => r !== null);
  // Never let a relay inflate N: recount from rows when rows are present.
  const delivered = rows.length ? rows.filter((r) => r.outcome === "delivered").length : n;
  const attempted = rows.length ? rows.filter((r) => r.outcome !== "not_attempted").length : m;
  return {
    version: typeof o.version === "string" ? o.version : "delivery_probes_v1",
    source,
    n_delivered: Math.min(n, delivered),
    m_attempted: rows.length ? attempted : m,
    not_attempted: Number.isFinite(Number(o.not_attempted)) ? Number(o.not_attempted) : rows.filter((r) => r.outcome === "not_attempted").length,
    latest_probe_unix: typeof o.latest_probe_unix === "number" ? o.latest_probe_unix : null,
    honesty: (o.honesty && typeof o.honesty === "object" ? (o.honesty as Record<string, string>) : {}),
    reproduce_sql: typeof o.reproduce_sql === "string" ? o.reproduce_sql : null,
    rows,
    fetched_at: fetchedAt,
  };
}

export function createDeliverySource(opts: {
  intelBase: string;
  publicDir: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheMs?: number;
}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const cacheMs = opts.cacheMs ?? DELIVERY_CACHE_MS;
  let cached: DeliverySummary | null = null;
  let cachedAt = 0;

  async function snapshot(error: string): Promise<DeliverySummary> {
    const at = new Date(now()).toISOString();
    try {
      const raw = JSON.parse(await readFile(path.join(opts.publicDir, "delivery.snapshot.json"), "utf8")) as unknown;
      const parsed = parseSummary(raw, "snapshot", at);
      if (parsed) return { ...parsed, error };
    } catch {
      /* no snapshot */
    }
    return { version: "delivery_probes_v1", source: "snapshot", n_delivered: 0, m_attempted: 0, not_attempted: 0, latest_probe_unix: null, honesty: {}, reproduce_sql: null, rows: [], fetched_at: at, error };
  }

  return async function load(): Promise<DeliverySummary> {
    const t = now();
    if (cached && t - cachedAt < cacheMs) return cached;
    try {
      const res = await fetchImpl(`${opts.intelBase}${DELIVERY_SUMMARY_PATH}`, {
        headers: { accept: "application/json", "user-agent": "x402-mrr/settled delivery relay" },
      });
      if (res.ok) {
        const parsed = parseSummary(await res.json(), "intel", new Date(t).toISOString());
        if (parsed) {
          cached = parsed;
          cachedAt = t;
          return parsed;
        }
        return snapshot("intel_summary_unparseable");
      }
      return snapshot(`intel_summary_http_${res.status}`);
    } catch (e) {
      return snapshot(`intel_unreachable:${(e as Error).name || "error"}`);
    }
  };
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

export function renderDeliveryHtml(s: DeliverySummary): string {
  const when = s.latest_probe_unix ? new Date(s.latest_probe_unix * 1000).toISOString().slice(0, 16) + "Z" : "n/a";
  const rows = s.rows
    .map((r) => {
      const tx = r.settlement_tx ? `${esc(r.settlement_tx.slice(0, 8))}…` : "";
      return `<tr class="${esc(r.outcome)}"><td>${esc(r.resource_url)}</td><td>${esc(r.outcome)}</td><td>${esc(r.failure_class ?? "")}</td><td>${r.http_status ?? ""}</td><td>${tx}</td></tr>`;
    })
    .join("\n");
  const src = s.source === "intel" ? "live intel" : "committed snapshot";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>x402 delivery: ${s.n_delivered} of ${s.m_attempted}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://settled.twzrd.xyz/delivery">
<link rel="stylesheet" href="/app.css"><style>table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:4px 6px;font-size:13px;text-align:left}tr.delivered td:nth-child(2){color:#1a7f37}tr.failed td:nth-child(2){color:#b42318}tr.not_attempted td:nth-child(2){color:#888}</style></head>
<body><main>
<h1>${s.n_delivered} of ${s.m_attempted} live x402 sellers deliver to a paying client</h1>
<p>Latest probe ${esc(when)} · source: ${esc(src)}${s.error ? ` (${esc(s.error)})` : ""} · <a href="/delivery.json">json</a></p>
<p>N = latest real paid probe returned HTTP 200 with a settlement tx. M = latest probe was a real attempt (delivered or failed). ${s.not_attempted} not attempted (our own client stopped first) are excluded. Not delivery_verified, not a quality score, not fulfillment proof.</p>
<table><thead><tr><th>resource</th><th>outcome</th><th>failure class</th><th>http</th><th>settlement tx</th></tr></thead><tbody>
${rows}
</tbody></table>
${s.reproduce_sql ? `<details><summary>reproduce</summary><pre>${esc(s.reproduce_sql)}</pre></details>` : ""}
</main></body></html>`;
}
