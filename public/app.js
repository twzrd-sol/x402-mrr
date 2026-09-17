const app = document.getElementById("app");

function usd(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function shortWallet(w) {
  if (!w || w.length < 12) return w;
  return `${w.slice(0, 4)} ${w.slice(4, 8)}…${w.slice(-4)}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stamp(lane) {
  const label = lane === "ranked" ? "confirmed" : lane === "flagged" ? "flagged" : "unevaluated";
  return `<span class="stamp ${lane}">${label}</span>`;
}

function barRow(lane, label, value, max) {
  const pct = max > 0 ? Math.max(1, (value / max) * 100) : 0;
  return `<div class="bar-row">
    <div>${escapeHtml(label)}</div>
    <div class="bar-track" aria-hidden="true"><div class="bar-fill ${lane}" style="width:${pct}%"></div></div>
    <div class="bar-amt">${usd(value)}</div>
  </div>`;
}

function sellerPath(wallet) {
  return `/seller/${encodeURIComponent(wallet)}`;
}

function table(rows) {
  if (!rows.length) {
    return `<p class="empty">No wallets in this lane for the current snapshot.</p>`;
  }
  const body = rows
    .map((row) => {
      const dark = row.gone_dark ? "dark" : "live";
      const growth =
        row.growth_pct === null || row.growth_pct === undefined
          ? "—"
          : `${row.growth_pct > 0 ? "+" : ""}${row.growth_pct.toFixed(1)}%`;
      return `<tr class="rowlink" tabindex="0" data-wallet="${escapeHtml(row.merchant)}">
        <td>${row.rank_in_lane}</td>
        <td class="wallet">${escapeHtml(shortWallet(row.merchant))}</td>
        <td class="num">${usd(row.total_revenue_usd_90d)}</td>
        <td class="num hide-sm">${Number(row.unique_payers_90d).toLocaleString("en-US")}</td>
        <td class="num hide-sm">${Number(row.total_tx_90d).toLocaleString("en-US")}</td>
        <td class="hide-sm">${escapeHtml(dark)}</td>
        <td class="num hide-sm">${escapeHtml(growth)}</td>
      </tr>`;
    })
    .join("");
  return `<table>
    <thead>
      <tr>
        <th>#</th>
        <th>wallet</th>
        <th class="num">observed USD / 90d</th>
        <th class="num hide-sm">payers</th>
        <th class="num hide-sm">txs</th>
        <th class="hide-sm">activity</th>
        <th class="num hide-sm">vs last snap</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function bindRows(root) {
  root.querySelectorAll("tr.rowlink").forEach((tr) => {
    const go = () => {
      const wallet = tr.getAttribute("data-wallet");
      if (wallet) window.location.href = sellerPath(wallet);
    };
    tr.addEventListener("click", go);
    tr.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        go();
      }
    });
  });
}

function colophon(board) {
  const src = board.source || {};
  return `<footer class="colophon">
    Snapshot ${escapeHtml(src.fetched_at || "none")} from
    <a href="${escapeHtml(src.intel_base || "")}${escapeHtml(src.sellers_path || "/v1/intel/sellers")}">intel sellers</a>,
    window ${escapeHtml(src.window || "90 days")}.
    Wash labels are copied, not recomputed. Ranked means <code>wash_flagged=false</code> only.
    <code>null</code> is unevaluated, not clean. This is not MRR and not a buy/sell marketplace.
  </footer>`;
}

function renderBoard(board) {
  const s = board.stats;
  const max = Math.max(s.ranked_volume_usd_90d, s.unevaluated_volume_usd_90d, s.flagged_volume_usd_90d, 1);
  const fetched = board.source.fetched_at ? new Date(board.source.fetched_at).toUTCString() : "no snapshot yet";
  app.innerHTML = `<main class="page">
    <div class="kicker"><span>Vol. 1 · public integrator</span><span>${escapeHtml(fetched)}</span></div>
    <header class="masthead">
      <h1>Settled <span class="not-mrr">not MRR</span></h1>
      <p class="deck">${escapeHtml(board.honesty.product)} ${escapeHtml(board.honesty.wash)}</p>
    </header>
    <section class="bars" aria-label="Observed volume by wash lane">
      ${barRow("ranked", `Confirmed · ${s.ranked}`, s.ranked_volume_usd_90d, max)}
      ${barRow("unevaluated", `Unevaluated · ${s.unevaluated}`, s.unevaluated_volume_usd_90d, max)}
      ${barRow("flagged", `Flagged · ${s.flagged}`, s.flagged_volume_usd_90d, max)}
    </section>
    <section class="folio">
      <p>90 days is intel's public scoring window, not the size of the corpus. Older settles stay in intel's event table; they slide off this metric.</p>
      <p>The grey lane is <em>unevaluated</em> (wash overlay never ran) — not undervalued, not clean. Ranked is <code>wash_flagged=false</code> only.</p>
    </section>
    <div class="tabs" role="tablist" aria-label="Wash lanes">
      <button type="button" role="tab" id="tab-ranked" aria-selected="true" aria-controls="panel-ranked">Confirmed</button>
      <button type="button" role="tab" id="tab-unevaluated" aria-selected="false" aria-controls="panel-unevaluated">Unevaluated</button>
      <button type="button" role="tab" id="tab-flagged" aria-selected="false" aria-controls="panel-flagged">Flagged</button>
    </div>
    <div id="board">
      <section class="panel" id="panel-ranked" role="tabpanel" data-lane="ranked">
        <p class="lede">Only wallets with <code>wash_flagged=false</code>. Intel still ranks many of these below flagged fleets because intel sorts by unique payers and leaves wash orthogonal.</p>
        ${table(board.ranked.rows)}
      </section>
      <section class="panel" id="panel-unevaluated" role="tabpanel" hidden data-lane="unevaluated">
        <p class="lede">Never evaluated — missing wash overlay, not a discount. Shown so the coverage gap is visible. Do not read this lane as clean or undervalued.</p>
        ${table(board.unevaluated.rows)}
      </section>
      <section class="panel" id="panel-flagged" role="tabpanel" hidden data-lane="flagged">
        <p class="lede">Observed volume that TWZRD flagged. Kept on the page so a payer-count leaderboard cannot hide it.</p>
        ${table(board.flagged.rows)}
      </section>
    </div>
    ${colophon(board)}
  </main>`;

  const tabs = [...app.querySelectorAll('[role="tab"]')];
  const panels = [...app.querySelectorAll('[role="tabpanel"]')];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("aria-controls");
      tabs.forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
      panels.forEach((p) => {
        p.hidden = p.id !== target;
      });
    });
  });
  bindRows(app);
}

function renderDetail(payload) {
  const row = payload.seller;
  const links = payload.links || {};
  app.innerHTML = `<main class="page detail">
    <p><a class="back" href="/">← Board</a></p>
    <p>${stamp(row.lane)}</p>
    <h2>${escapeHtml(row.merchant)}</h2>
    <dl class="facts">
      <div class="fact"><dt>observed USD / 90d</dt><dd>${usd(row.total_revenue_usd_90d)}</dd></div>
      <div class="fact"><dt>unique payers</dt><dd>${Number(row.unique_payers_90d).toLocaleString("en-US")}</dd></div>
      <div class="fact"><dt>txs</dt><dd>${Number(row.total_tx_90d).toLocaleString("en-US")}</dd></div>
      <div class="fact"><dt>wash</dt><dd>${escapeHtml(String(row.wash_flagged))} / ${escapeHtml(row.wash_label || "—")}</dd></div>
      <div class="fact"><dt>activity</dt><dd>${row.gone_dark ? "gone dark" : "recent"} · ${row.days_since_last_settle ?? "—"} d</dd></div>
      <div class="fact"><dt>vs last snap</dt><dd>${row.growth_pct === null || row.growth_pct === undefined ? "—" : `${row.growth_pct.toFixed(1)}%`}</dd></div>
    </dl>
    <p class="lede">This page copies TWZRD's public seller row. It does not recompute wash and it does not attest delivery. Paid intel receipts stay on intel.twzrd.xyz.</p>
    <p class="links">
      <a href="${escapeHtml(links.merchant_card || "#")}">merchant card</a>
      <a href="${escapeHtml(links.intel_sellers || "#")}">sellers API</a>
    </p>
  </main>`;
}

async function boot() {
  const sellerMatch = window.location.pathname.match(/^\/seller\/([^/]+)\/?$/);
  try {
    if (sellerMatch) {
      const wallet = decodeURIComponent(sellerMatch[1]);
      const res = await fetch(`/api/seller/${encodeURIComponent(wallet)}`);
      if (res.status === 404) {
        app.innerHTML = `<main class="page"><p class="error">Wallet not in the latest snapshot.</p><p><a class="back" href="/">← Board</a></p></main>`;
        return;
      }
      if (!res.ok) throw new Error(`seller ${res.status}`);
      renderDetail(await res.json());
      return;
    }
    const res = await fetch("/api/leaderboard?limit=50");
    if (!res.ok) throw new Error(`leaderboard ${res.status}`);
    renderBoard(await res.json());
  } catch (err) {
    app.innerHTML = `<main class="page"><p class="error">Could not load the snapshot. ${escapeHtml(err.message || err)}</p></main>`;
  }
}

boot();
