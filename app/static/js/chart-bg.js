// Decorative background: randomly generated, slowly scrolling market charts.
// Purely visual (random data, not real prices). Redrawn with a new random walk on every page load.
(function () {
  const canvas = document.getElementById("chart-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STEP = 84;        // px between line points
  const CANDLE_STEP = 24; // px between candles
  const SPEED = 16;       // scroll speed, px per second

  const PALETTES = {
    dark: {
      lines: ["79,139,255", "255,95,168", "59,224,208"],
      stroke: 0.6, fill: 0.2, grid: "rgba(255,255,255,0.055)",
      up: "50,215,75", down: "255,69,58", candle: 0.3,
    },
    light: {
      lines: ["47,107,255", "224,69,154", "18,181,165"],
      stroke: 0.5, fill: 0.15, grid: "rgba(40,60,130,0.08)",
      up: "31,174,77", down: "224,57,47", candle: 0.26,
    },
  };

  let w = 0, h = 0, dpr = 1;
  let offset = 0;
  let last = 0;
  let raf = 0;

  // --- random data -----------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeLine(band, amp) {
    return { band, amp, x: 0, v: Math.random(), drift: rand(-0.04, 0.04), pts: [] };
  }
  function nextValue(s) {
    // mean-reverting random walk with a slowly changing trend
    s.drift += rand(-0.02, 0.02);
    s.drift *= 0.92;
    s.v += s.drift + rand(-0.12, 0.12) + (0.5 - s.v) * 0.07;
    s.v = Math.min(1, Math.max(0, s.v));
    return s.v;
  }
  function feedLine(s, untilX) {
    if (s.pts.length === 0) s.pts.push({ x: -STEP, v: s.v });
    while (s.pts[s.pts.length - 1].x < untilX) {
      const p = s.pts[s.pts.length - 1];
      s.pts.push({ x: p.x + STEP, v: nextValue(s) });
    }
    while (s.pts.length > 2 && s.pts[1].x < offset - STEP) s.pts.shift();
  }

  const candles = { pts: [], price: 0.5 };
  function feedCandles(untilX) {
    const c = candles;
    if (c.pts.length === 0) c.pts.push({ x: -CANDLE_STEP, o: 0.5, c: 0.5, hi: 0.5, lo: 0.5 });
    while (c.pts[c.pts.length - 1].x < untilX) {
      const o = c.price;
      const close = Math.min(0.95, Math.max(0.05, o + rand(-0.14, 0.14) + (0.5 - o) * 0.08));
      const hi = Math.min(1, Math.max(o, close) + rand(0.01, 0.09));
      const lo = Math.max(0, Math.min(o, close) - rand(0.01, 0.09));
      c.price = close;
      c.pts.push({ x: c.pts[c.pts.length - 1].x + CANDLE_STEP, o, c: close, hi, lo });
    }
    while (c.pts.length > 2 && c.pts[1].x < offset - CANDLE_STEP) c.pts.shift();
  }

  let lines = [];

  function setup() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lines.length === 0) {
      lines = [makeLine(0.3, 0.2), makeLine(0.5, 0.22), makeLine(0.68, 0.2)];
    }
  }

  // --- drawing ---------------------------------------------------------
  function yOf(s, v) { return (s.band - s.amp / 2 + (1 - v) * s.amp) * h; }

  function linePath(s, pts, headX) {
    ctx.beginPath();
    let prev = null;
    for (const p of pts) {
      const x = p.x - offset, y = yOf(s, p.v);
      if (!prev) ctx.moveTo(x, y);
      else {
        const mx = (prev.x + x) / 2, my = (prev.y + y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      prev = { x, y };
    }
    if (prev) ctx.lineTo(prev.x, prev.y);
  }

  function draw() {
    const pal = PALETTES[document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"];
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) { const y = Math.round((h / 8) * i) + 0.5; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    const gx = 120, shift = offset % gx;
    for (let x = -shift; x < w; x += gx) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    ctx.stroke();

    // candlesticks along the bottom
    feedCandles(offset + w + CANDLE_STEP);
    const top = h * 0.74, span = h * 0.24;
    for (const c of candles.pts) {
      const x = c.x - offset;
      const up = c.c >= c.o;
      const col = up ? pal.up : pal.down;
      const y = (v) => top + (1 - v) * span;
      ctx.strokeStyle = "rgba(" + col + "," + pal.candle + ")";
      ctx.fillStyle = "rgba(" + col + "," + pal.candle + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y(c.hi));
      ctx.lineTo(x, y(c.lo));
      ctx.stroke();
      const yo = y(c.o), yc = y(c.c);
      ctx.fillRect(x - 5, Math.min(yo, yc), 10, Math.max(2, Math.abs(yo - yc)));
    }

    // line charts with area fill and glow
    lines.forEach((s, i) => {
      feedLine(s, offset + w + STEP);
      const rgb = pal.lines[i];

      linePath(s, s.pts);
      const last = s.pts[s.pts.length - 1];
      ctx.lineTo(last.x - offset, h);
      ctx.lineTo(s.pts[0].x - offset, h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, (s.band - s.amp / 2) * h, 0, (s.band + s.amp / 2) * h + h * 0.12);
      g.addColorStop(0, "rgba(" + rgb + "," + pal.fill + ")");
      g.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = g;
      ctx.fill();

      ctx.lineJoin = "round";
      linePath(s, s.pts);
      ctx.strokeStyle = "rgba(" + rgb + "," + pal.stroke * 0.25 + ")";
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = "rgba(" + rgb + "," + pal.stroke + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 28) return; // ~35 fps is plenty for a slow background
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
    last = t;
    offset += SPEED * dt;
    draw();
  }

  setup();
  // Pre-roll so the very first frame already looks like a chart in progress.
  draw();
  if (!reduceMotion) raf = requestAnimationFrame(frame);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { setup(); draw(); }, 150);
  });
  document.addEventListener("visibilitychange", () => {
    if (reduceMotion) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = 0; raf = requestAnimationFrame(frame); }
  });
  // Repaint immediately when the theme flips (needed when animation is off).
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
