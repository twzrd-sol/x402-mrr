import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { HONESTY } from "./honesty.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBID =
  "Do not create an `x402-mrr` Doppler project until a secret actually exists.";

/** Present-tense unapplied claims that were true before 2026-09-17 and must not return. */
const STALE_UNAPPLIED: Array<{ re: RegExp; sample: string }> = [
  { re: /staged,\s*not live/i, sample: "# Deploy (staged, not live)" },
  {
    re: /ingress are \*\*held\*\*/i,
    sample: "Public hostname and Cloudflare Tunnel ingress are **held**.",
  },
  {
    re: /no Cloudflare Tunnel until the operator names/i,
    sample:
      "No intel DB, no outbid token, no Cloudflare Tunnel until the operator names that change.",
  },
  {
    re: /Do \*\*not\*\* `systemctl --user enable --now`/,
    sample:
      "Do **not** `systemctl --user enable --now` it until the operator names that step.",
  },
  { re: /enable only when told/i, sample: "# enable only when told" },
  { re: /\(no DNS today\)/i, sample: "Hostname: `settled.twzrd.xyz` (no DNS today)" },
];

function shippedOperatorDocs(): { name: string; text: string }[] {
  return [
    ["README.md", "README.md"],
    ["ops/README.md", path.join("ops", "README.md")],
    ["AGENTS.md", "AGENTS.md"],
  ].map(([name, rel]) => ({
    name,
    text: readFileSync(path.join(root, rel), "utf8"),
  }));
}

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

test("stale unapplied patterns still catch the 2026-09-17 pre-apply wording", () => {
  for (const { re, sample } of STALE_UNAPPLIED) {
    assert.match(sample, re, `guard went hollow: ${re} must flag ${JSON.stringify(sample)}`);
  }
});

test("shipped operator docs match the applied 2026-09-17 public origin", () => {
  for (const { name, text } of shippedOperatorDocs()) {
    assert.match(text, /https:\/\/settled\.twzrd\.xyz/);
    assert.match(text, /127\.0\.0\.1:4040/);
    assert.match(text, /applied 2026-09-17/);
    assert.match(text, /not MRR|never MRR/i);
    for (const { re, sample } of STALE_UNAPPLIED) {
      assert.equal(
        re.test(text),
        false,
        `${name} reintroduced unapplied claim matching ${re} (sample: ${sample})`,
      );
    }
  }
  const rootReadme = shippedOperatorDocs()[0].text;
  assert.match(rootReadme, /wash_flagged=null.*never "clean"|never treated as clean/i);
  assert.match(rootReadme, /wash_flagged=true.*never enters the ranked lane/i);
});

test("shipped honesty copy forbids calling the metric MRR", () => {
  assert.match(HONESTY.not_this_product, /not MRR/i);
  assert.match(HONESTY.metric, /do not call this MRR/i);
  assert.match(HONESTY.wash, /null = never evaluated/);
  assert.match(HONESTY.wash, /never treated as clean/);
  assert.match(HONESTY.wash, /true = flagged, excluded from ranked/);
  assert.match(HONESTY.wash, /not a discount/);
  assert.match(HONESTY.window, /not the size of the corpus/);
  assert.match(HONESTY.window, /slide off this board/);
});

test("board JS explains the 90d window and unevaluated lane", () => {
  const js = readFileSync(path.join(root, "public", "app.js"), "utf8");
  assert.match(js, /scoring window, not the size of the corpus/);
  assert.match(js, /not undervalued, not clean/);
  assert.match(js, /not a discount/);
  assert.match(js, /not MRR/);
  assert.match(js, /partial_inbound_only/);
  assert.match(js, /full overlay/);
  assert.match(js, /inbound only/);
  assert.match(js, /unique payers with wash orthogonal/);
  assert.match(js, /never puts/);
  assert.match(js, /fleet_dominated/);
  assert.match(js, /laneFromHash/);
  assert.match(js, /#\$\{lane\}/);
  const html = readFileSync(path.join(root, "public", "index.html"), "utf8");
  assert.match(html, /app\.js\?v=/);
});
