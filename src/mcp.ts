import type { Store } from "./store.ts";

interface RpcReq {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

const TOOLS = [
  {
    name: "leaderboard",
    description:
      "x402 observed settled volume by wash lane. Ranked is wash_flagged=false only. null is unevaluated, not clean. Not MRR.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Rows per lane, 1-200, default 25" },
      },
    },
  },
  {
    name: "seller",
    description: "One receive wallet from the latest snapshot, including lane and wash tri-state.",
    inputSchema: {
      type: "object",
      properties: {
        wallet: { type: "string" },
      },
      required: ["wallet"],
    },
  },
];

function ok(id: RpcReq["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: RpcReq["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function handleMcp(store: Store, body: unknown): unknown {
  const req = (body ?? {}) as RpcReq;
  const id = req.id ?? null;
  const method = req.method ?? "";
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "x402-mrr", version: "0.1.0" },
    });
  }
  if (method === "notifications/initialized") {
    return ok(id, {});
  }
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }
  if (method === "tools/call") {
    const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    const name = params.name ?? "";
    const args = params.arguments ?? {};
    if (name === "leaderboard") {
      const limit = Number(args.limit ?? 25);
      const board = store.board(Number.isFinite(limit) ? limit : 25);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(board) }],
      });
    }
    if (name === "seller") {
      const wallet = String(args.wallet ?? "");
      const row = wallet ? store.seller(wallet) : null;
      if (!row) return err(id, -32004, "seller not in latest snapshot");
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(row) }],
      });
    }
    return err(id, -32601, `unknown tool ${name}`);
  }
  return err(id, -32601, `unknown method ${method}`);
}
