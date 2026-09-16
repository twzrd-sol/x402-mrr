import path from "node:path";

export interface Config {
  bind: string;
  port: number;
  intelBase: string;
  dataDir: string;
  dbPath: string;
  refreshMs: number;
  pageDelayMs: number;
  pageLimit: number;
  maxPages: number;
  publicLimit: number;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

export function loadConfig(cwd = process.cwd()): Config {
  const dataDir = path.resolve(cwd, env("DATA_DIR", "data"));
  const bind = env("BIND", "127.0.0.1");
  const port = Number(env("PORT", "4040"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1-65535, got ${process.env.PORT}`);
  }
  return {
    bind,
    port,
    intelBase: env("INTEL_BASE", "https://intel.twzrd.xyz").replace(/\/$/, ""),
    dataDir,
    dbPath: path.join(dataDir, "settled.sqlite"),
    refreshMs: Number(env("REFRESH_MS", "3600000")),
    pageDelayMs: Number(env("PAGE_DELAY_MS", "75")),
    pageLimit: 200,
    maxPages: 40,
    publicLimit: 50,
  };
}
