import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("delivery.json is 18 of 43 unique sellers", () => {
  const d = JSON.parse(readFileSync(path.join(root, "public/delivery.json"), "utf8"));
  assert.equal(d.n_delivered, 18);
  assert.equal(d.m_probed, 43);
  assert.equal(d.attempts, 48);
  assert.equal(d.sellers.length, 43);
  assert.equal(d.sellers.filter((s: { delivered: boolean }) => s.delivered).length, 18);
  for (const s of d.sellers) {
    if (s.delivered) {
      assert.equal(s.http_status, 200);
      assert.ok(s.settlement_tx);
      assert.equal(s.paid, true);
    }
  }
});

test("delivery.html states the N of M sentence", () => {
  const html = readFileSync(path.join(root, "public/delivery.html"), "utf8");
  assert.match(html, /live x402 sellers deliver to a paying client/);
  assert.match(html, /delivery\.json/);
});
