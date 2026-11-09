// CoinPulse frontend. Talks only to the Flask backend (never to CoinGecko directly).
const REFRESH_MS = 60000;

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
});
const compact = new Intl.NumberFormat("id-ID", {
  notation: "compact", maximumFractionDigits: 2,
});

const $ = (id) => document.getElementById(id);

let coins = [];      // latest market data
let watchlist = [];  // entries from PostgreSQL
let marketAnimated = false; // play the row entrance animation only once

// ---------- helpers ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const money = (n) => (n == null ? "–" : idr.format(n));
const bigMoney = (n) => (n == null ? "–" : "Rp " + compact.format(n));

function percent(n) {
  if (n == null) return { text: "–", cls: "" };
  const sign = n > 0 ? "+" : "";
  return { text: sign + n.toFixed(2) + "%", cls: n >= 0 ? "up" : "down" };
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB");
}

function setStatus(kind, text) {
  $("status-dot").className = "dot dot-" + kind;
  $("status-text").textContent = text;
}

async function api(path, options) {
  const res = await fetch(path, options);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || "Request failed (" + res.status + ")");
  return body;
}

// ---------- market ----------
function showMarketState(state) {
  $("market-loading").hidden = state !== "loading";
  $("market-error").hidden = state !== "error";
  $("market-empty").hidden = state !== "empty";
  $("market-table-wrap").hidden = state !== "table";
}

function renderSummary(s) {
  $("sum-cap").textContent = s ? bigMoney(s.total_market_cap) : "–";
  $("sum-vol").textContent = s ? bigMoney(s.total_volume_24h) : "–";
  $("sum-btc").textContent = s ? s.btc_dominance.toFixed(1) + "%" : "–";
  const change = $("sum-change");
  const p = s ? percent(s.market_cap_change_24h) : { text: "–", cls: "" };
  change.textContent = p.text;
  change.className = "stat-value " + p.cls;
}

function starIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z");
  svg.appendChild(path);
  return svg;
}

function renderMarket() {
  const body = $("market-body");
  body.replaceChildren();

  if (coins.length === 0) {
    showMarketState("empty");
    return;
  }

  coins.forEach((c, i) => {
    const saved = watchlist.find((w) => w.coin_id === c.id);
    const tr = el("tr");
    tr.style.setProperty("--i", i);
    if (!marketAnimated) tr.className = "enter";

    const rankCell = el("td", "num");
    rankCell.appendChild(el("span", "rank rank-" + c.rank, String(c.rank)));
    tr.appendChild(rankCell);

    const assetCell = el("td");
    const asset = el("div", "asset");
    const img = el("img");
    img.src = c.image;
    img.alt = "";
    img.width = 28;
    img.height = 28;
    asset.appendChild(img);
    const label = el("div");
    label.appendChild(el("span", "asset-name", c.name));
    label.appendChild(el("span", "asset-symbol", c.symbol));
    asset.appendChild(label);
    assetCell.appendChild(asset);
    tr.appendChild(assetCell);

    tr.appendChild(el("td", "num price", money(c.price)));

    const p = percent(c.change_24h);
    const arrow = c.change_24h == null ? "" : c.change_24h >= 0 ? "▲ " : "▼ ";
    const changeCell = el("td", "num");
    changeCell.appendChild(el("span", "pill " + p.cls, arrow + p.text));
    tr.appendChild(changeCell);

    tr.appendChild(el("td", "num", bigMoney(c.market_cap)));
    tr.appendChild(el("td", "num", bigMoney(c.volume_24h)));

    const starCell = el("td", "num");
    const star = el("button", "star-btn");
    star.type = "button";
    star.setAttribute("aria-pressed", saved ? "true" : "false");
    star.setAttribute("aria-label", (saved ? "Remove " : "Add ") + c.name + (saved ? " from" : " to") + " watchlist");
    star.appendChild(starIcon());
    star.addEventListener("click", () => toggleWatch(c, saved, star));
    starCell.appendChild(star);
    tr.appendChild(starCell);

    body.appendChild(tr);
  });
  marketAnimated = true;
  showMarketState("table");
}

async function loadMarket() {
  try {
    const data = await api("/api/market");
    coins = data.coins;
    renderSummary(data.summary);
    renderMarket();
    renderWatchlist();
    const time = formatTime(data.updated_at);
    $("updated-at").textContent = "Last updated " + time;
    if (data.stale) {
      setStatus("stale", "CoinGecko unavailable. Showing data from " + time);
    } else {
      setStatus("live", "Updated " + time);
    }
  } catch (err) {
    // Keep showing old data if we have it; otherwise show the error state.
    if (coins.length === 0) {
      $("market-error-text").textContent = err.message;
      showMarketState("error");
    }
    setStatus("error", "Market data unavailable");
  }
}

// ---------- watchlist ----------
function showWatchError(message) {
  const box = $("watchlist-error");
  box.textContent = message || "";
  box.hidden = !message;
}

function renderWatchlist() {
  const list = $("watchlist-items");
  list.replaceChildren();
  $("watchlist-empty").hidden = watchlist.length > 0;
  $("watchlist-count").textContent = watchlist.length ? watchlist.length + " saved" : "";

  for (const w of watchlist) {
    const live = coins.find((c) => c.id === w.coin_id);
    const li = el("li", "watch-item");

    const img = el("img");
    img.src = w.image || "";
    img.alt = "";
    img.width = 26;
    img.height = 26;
    li.appendChild(img);

    const info = el("div", "watch-info");
    info.appendChild(el("div", "watch-name", w.name + " (" + w.symbol + ")"));
    info.appendChild(el("div", "watch-price", live ? money(live.price) : "Not in current top 5"));
    li.appendChild(info);

    const btn = el("button", "remove-btn", "Remove");
    btn.type = "button";
    btn.setAttribute("aria-label", "Remove " + w.name + " from watchlist");
    btn.addEventListener("click", () => removeWatch(w.id, btn));
    li.appendChild(btn);

    list.appendChild(li);
  }
}

async function loadWatchlist() {
  try {
    watchlist = await api("/api/watchlist");
    showWatchError("");
  } catch (err) {
    showWatchError("Could not load the watchlist: " + err.message);
  }
  renderWatchlist();
  if (coins.length > 0) renderMarket(); // refresh the star states
}

async function addWatch(coin, button) {
  button.disabled = true;
  try {
    await api("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coin_id: coin.id }),
    });
    showWatchError("");
  } catch (err) {
    showWatchError(err.message);
  }
  await loadWatchlist();
}

async function removeWatch(id, button) {
  button.disabled = true;
  try {
    await api("/api/watchlist/" + id, { method: "DELETE" });
    showWatchError("");
  } catch (err) {
    showWatchError(err.message);
  }
  await loadWatchlist();
}

function toggleWatch(coin, saved, button) {
  return saved ? removeWatch(saved.id, button) : addWatch(coin, button);
}

// ---------- glass specular highlight follows the cursor ----------
const glassEls = document.querySelectorAll(".topbar-inner, .stat, .card");
document.addEventListener("pointermove", (e) => {
  for (const g of glassEls) {
    const r = g.getBoundingClientRect();
    g.style.setProperty("--mx", e.clientX - r.left + "px");
    g.style.setProperty("--my", e.clientY - r.top + "px");
  }
});

// ---------- light / dark theme ----------
const themeBtn = $("theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function syncThemeUi() {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  themeBtn.setAttribute("aria-checked", light ? "true" : "false");
  if (themeColor) themeColor.setAttribute("content", light ? "#eaf0ff" : "#0a0c1c");
}

themeBtn.addEventListener("click", () => {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  root.classList.add("theme-anim");
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("coinpulse-theme", next); } catch (e) { /* storage blocked */ }
  syncThemeUi();
  setTimeout(() => root.classList.remove("theme-anim"), 700);
});
syncThemeUi();

// ---------- start ----------
$("retry-btn").addEventListener("click", () => {
  showMarketState("loading");
  loadMarket();
});

(async function init() {
  await loadWatchlist();
  await loadMarket();
  setInterval(loadMarket, REFRESH_MS);
})();
