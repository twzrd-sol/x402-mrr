import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBID =
  "Do not create an `x402-mrr` Doppler project until a secret actually exists.";

test("ops docs name Doppler project x402-mrr config prd", () => {
  const readme = readFileSync(path.join(root, "ops", "README.md"), "utf8");
  const agents = readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const tunnel = readFileSync(path.join(root, "ops", "TUNNEL-REVIEW.md"), "utf8");
  for (const text of [readme, agents, tunnel]) {
    assert.match(text, /x402-mrr/);
    assert.match(text, /\bprd\b/);
    assert.equal(text.includes(FORBID), false);
  }
  assert.match(readme, /doppler run -p x402-mrr -c prd/);
});
