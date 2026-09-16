import { serve } from "@hono/node-server";
import { loadConfig } from "./config.ts";
import { latestSnapshot, openDb } from "./db.ts";
import { createStore } from "./store.ts";
import { createApp } from "./server.ts";

const config = loadConfig();
const db = openDb(config.dbPath);
const store = createStore(db, config);
const app = createApp(store, config);

const refreshOnce = process.argv.includes("--refresh-once");

async function refreshSafe(reason: string): Promise<void> {
  try {
    const result = await store.refresh();
    console.log(
      JSON.stringify({
        event: "refresh_ok",
        reason,
        sellers: result.sellers,
        pages: result.pages,
        truncated: result.truncated,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "refresh_failed", reason, message }));
    if (refreshOnce) throw err;
  }
}

function snapshotIsFresh(): boolean {
  const snap = latestSnapshot(db);
  if (!snap) return false;
  const age = Date.now() - Date.parse(snap.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < config.refreshMs;
}

if (refreshOnce) {
  await refreshSafe("once");
  process.exit(0);
}

if (snapshotIsFresh()) {
  const snap = latestSnapshot(db);
  console.log(
    JSON.stringify({
      event: "refresh_skipped",
      reason: "startup_fresh",
      fetched_at: snap?.fetchedAt ?? null,
      sellers: store.health().sellers,
    }),
  );
} else {
  await refreshSafe("startup");
}
if (config.refreshMs > 0) {
  setInterval(() => {
    void refreshSafe("timer");
  }, config.refreshMs);
}

serve(
  {
    fetch: app.fetch,
    hostname: config.bind,
    port: config.port,
  },
  (info) => {
    console.log(
      JSON.stringify({
        event: "listen",
        url: `http://${info.address}:${info.port}`,
        bind: config.bind,
        db: config.dbPath,
      }),
    );
  },
);
