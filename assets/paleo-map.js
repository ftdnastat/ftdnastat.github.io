(function () {
  "use strict";
  const fig = document.getElementById("pmap");
  const blobEl = document.getElementById("pmap-data");
  if (!fig || !blobEl || !window.PaleoMapCore || !window.EqEarth || !window.YmapCore) return;
  const D = JSON.parse(blobEl.textContent), S = D.s, lang = D.lang, C = window.PaleoMapCore;
  const frame = fig.querySelector(".cmap-frame"), cap = fig.querySelector(".cmap-cap"), legend = fig.querySelector(".pmap-legend"), rangeCap = fig.querySelector(".pmap-range");
  const range = fig.querySelector("#pmap-time"), out = fig.querySelector("#pmap-time-out"), playBtn = fig.querySelector("[data-play]");
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const nf = (x) => x.toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const yearText = (y) => { const r = Math.abs(y) >= 1000 ? Math.round(y / 50) * 50 : Math.round(y / 10) * 10; return r < 0 ? fmt(S.bce, { y: nf(-r) }) : fmt(S.ce, { y: nf(r) }); };

  Promise.all([
    (window.ftdMapWorld = window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json())),
    fetch(D.src).then((r) => r.json()),
  ]).then(([geo, P]) => {
    const proj = (lon, lat) => EqEarth.toMap(geo.proj, lon, lat);
    // radius from a northward step: an eastward one would jump across the projection's seam
    const place = (lat, lon) => { const [x, y] = proj(lon, lat), [, y2] = proj(lon, lat + 0.7); return { x, y, r: Math.abs(y2 - y) }; };
    const pts = {
      y: P.y.map((p) => ({ p, kind: "y", unit: p[5], letter: P.letters.y[p[6]] })),
      mt: P.mt.map((p) => ({ p, kind: "mt", unit: p[3], letter: P.letters.mt[p[4]] })),
    };
    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.getAttribute("aria-label") });
    const defs = el("defs", {});
    const landD = geo.units.map((u) => u.d).join("");
    const clip = el("clipPath", { id: "pmap-land" });
    clip.appendChild(el("path", { d: landD }));
    defs.appendChild(clip);
    const blur = el("filter", { id: "pmap-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    blur.appendChild(el("feGaussianBlur", { stdDeviation: "1.2" }));
    defs.appendChild(blur);
    svg.appendChild(defs);
    svg.appendChild(el("path", { d: landD, class: "gm-land" }));
    const heatClip = el("g", { "clip-path": "url(#pmap-land)" }), heat = el("g", { filter: "url(#pmap-blur)", class: "pm-heat" });
    heatClip.appendChild(heat);
    svg.appendChild(heatClip);
    // one path per colour, grey first: overlapping translucent discs of one colour would show their edges
    const paths = new Map();
    for (let i = 0; i <= C.SLOTS; i++) { const p = el("path", { class: "c" + i }); heat.appendChild(p); paths.set(i, p); }
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    const rangeClip = el("g", { "clip-path": "url(#pmap-land)" }), rangePath = el("path", { class: "pm-range" });
    rangeClip.appendChild(rangePath);
    svg.appendChild(rangeClip);
    frame.appendChild(svg);

    let layer = "cultures", slots = new Map(), shown = [], pinned = null;
    let ranges = null, rangesReq = null, pick = null;
    const loadRanges = () => { if (!rangesReq && D.ranges) rangesReq = fetch(D.ranges).then((r) => r.json()).then((R) => { ranges = R; draw(); }).catch((e) => { rangesReq = null; console.error("palaeo ranges:", e); }); };
    // Discover longitudes pass ±180: a ring is drawn again a turn away where it overlaps the map
    const ringD = (enc) => {
      const pts = YmapCore.decodePolyline(enc, ranges.precision), lons = pts.map((p) => p[1]), lo = Math.min(...lons), hi = Math.max(...lons);
      let d = "";
      for (const k of [-360, 0, 360]) if (lo + k - lon0 < 180 && hi + k - lon0 > -180) d += pts.map(([lat, lon], i) => { const [x, y] = projTurns(lon + k, lat); return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1); }).join("") + "Z";
      return d;
    };
    // proj folds longitude into one turn; x is linear in longitude, so whole turns are added back as map widths
    const lon0 = geo.proj.lon0 || 0;
    const projTurns = (lon, lat) => { const n = Math.round((lon - lon0) / 360), [x, y] = proj(lon - 360 * n, lat); return [x + n * 4 * (proj(lon0 + 90, lat)[0] - proj(lon0, lat)[0]), y]; };
    const views = Object.assign({ world: [0, 0, geo.w, geo.h] }, geo.views);
    const macroSlot = (kind, l) => { const i = (D.macro[kind] || []).indexOf(l); return i >= 0 ? i + 1 : 0; };
    const nameOf = (g) => (layer === "cultures" ? P.units[g.key][lang] : g.key);
    const disc = (q) => "M" + (q.x - q.r).toFixed(2) + "," + q.y.toFixed(2) + "a" + q.r.toFixed(2) + "," + q.r.toFixed(2) + " 0 1,0 " + (2 * q.r).toFixed(2) + ",0a" + q.r.toFixed(2) + "," + q.r.toFixed(2) + " 0 1,0 " + (-2 * q.r).toFixed(2) + ",0";

    function draw() {
      const ago = C.agoOf(Number(range.value)), year = D.present - ago, half = C.halfWidth(ago);
      const src = layer === "mt" ? pts.mt : layer === "y" ? pts.y : pts.y.concat(pts.mt);
      const win = src.filter((q) => C.covers(q.kind, q.p, year, half));
      const keyOf = layer === "cultures" ? (q) => q.unit : (q) => q.letter;
      const gs = C.groups(win, keyOf);
      let slotOf;
      if (layer === "cultures") { slots = C.assignSlots(slots, gs.map((g) => g.key)); slotOf = (k) => slots.get(k) || 0; } else slotOf = (k) => macroSlot(layer, k);
      // a patch per 1° cell, at its points' mean: a cell centre or a wide patch spills over mountain ranges
      const cells = new Map();
      for (const q of win) {
        const lat = Math.floor(q.p[0]), lon = Math.floor(q.p[1]), ck = lat + "," + lon;
        if (!cells.has(ck)) cells.set(ck, { lat: 0, lon: 0, n: 0, by: new Map() });
        const c = cells.get(ck), k = keyOf(q);
        c.n++;
        c.lat += q.p[0];
        c.lon += q.p[1];
        if (k != null && k !== -1) c.by.set(k, (c.by.get(k) || 0) + 1);
      }
      const ds = new Map([...paths.keys()].map((i) => [i, []]));
      shown = [];
      for (const c of cells.values()) {
        const top = [...c.by].sort((a, b) => b[1] - a[1]);
        const pos = place(c.lat / c.n, c.lon / c.n), q = { ...pos, cell: c, top };
        ds.get(top.length ? slotOf(top[0][0]) : 0).push(disc(q));
        shown.push(q);
      }
      for (const [i, p] of paths) p.setAttribute("d", ds.get(i).join(""));
      out.textContent = fmt(S.when, { year: yearText(year), half: nf(half) }) + " · " + fmt(S.count, { n: nf(win.length) });
      range.setAttribute("aria-valuetext", out.textContent);
      const focused = legend.contains(document.activeElement) ? document.activeElement.dataset.letter : null;
      legend.textContent = "";
      const coloured = gs.filter((g) => slotOf(g.key) > 0).slice(0, C.SLOTS);
      const pickable = (k) => layer === "y" && D.ranges && (!ranges || ranges.y[k]) ? k : null;
      for (const g of coloured) swatch("c" + slotOf(g.key), nameOf(g) + " " + nf(g.pts.length), pickable(g.key));
      if (pick && pickable(pick) && !coloured.some((g) => g.key === pick)) swatch("c" + macroSlot("y", pick), pick + " 0", pick);
      if (win.length > coloured.reduce((a, g) => a + g.pts.length, 0)) swatch("c0", S.other);
      drawRange(year);
      if (focused) { const b = legend.querySelector('[data-letter="' + focused + '"]'); if (b) b.focus(); }
      if (!win.length) cap.textContent = S.none;
      else if (pinned == null) cap.textContent = S.hint;
    }
    function swatch(cls, text, letter) {
      const s = document.createElement(letter ? "button" : "span"), i = document.createElement("i");
      i.className = cls;
      s.appendChild(i);
      s.appendChild(document.createTextNode(text));
      if (letter) {
        s.type = "button";
        s.className = "pm-pick " + cls;
        s.dataset.letter = letter;
        s.setAttribute("aria-describedby", rangeCap.id);
        s.setAttribute("aria-pressed", String(letter === pick));
        s.addEventListener("click", () => { pick = pick === letter ? null : letter; draw(); });
      }
      legend.appendChild(s);
    }
    function drawRange(year) {
      const on = layer === "y" && D.ranges;
      rangeCap.hidden = !on;
      if (on) loadRanges();
      const f = on && pick && ranges ? C.frameAt(ranges.y[pick], year) : null;
      rangePath.setAttribute("d", f ? f[1].map(ringD).join("") : "");
      rangePath.setAttribute("class", "pm-range c" + (pick ? macroSlot("y", pick) : 0));
      rangeCap.textContent = f ? fmt(S.range, { l: pick, year: yearText(f[0]) }) : S.rangeHint;
    }

    function hit(ev) {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      let best = null, bd = Infinity;
      for (const q of shown) { const d = (q.x - pt.x) ** 2 + (q.y - pt.y) ** 2; if (d < bd && d <= q.r * q.r) { bd = d; best = q; } }
      return best;
    }
    function describe(q) {
      cap.textContent = "";
      if (!q) { cap.textContent = shown.length ? S.hint : S.none; return; }
      cap.appendChild(document.createTextNode(fmt(S.cell, { n: nf(q.cell.n) }) + ": "));
      const top = q.top.slice(0, 3);
      if (!top.length) cap.appendChild(document.createTextNode(layer === "cultures" ? S.noCulture : S.noLetter));
      top.forEach(([k, v], i) => {
        if (i) cap.appendChild(document.createTextNode(", "));
        const u = layer === "cultures" ? P.units[k] : null;
        const a = document.createElement(u && u.href ? "a" : "span");
        a.textContent = u ? u[lang] : k;
        if (u && u.href) a.href = u.href.replace("{lang}", lang);
        cap.appendChild(a);
        cap.appendChild(document.createTextNode(" " + nf(v)));
      });
    }
    svg.addEventListener("pointermove", (ev) => { if (pinned == null && ev.pointerType !== "touch") describe(hit(ev)); });
    svg.addEventListener("click", (ev) => { const s = hit(ev); pinned = s && s !== pinned ? s : null; describe(pinned); });

    let view = views.europe ? "europe" : "world";
    function show() {
      svg.setAttribute("viewBox", views[view].map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", view !== "world");
      fig.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
      fig.querySelectorAll("[data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === layer)));
    }
    fig.querySelectorAll("[data-v]").forEach((b) => { if (!views[b.dataset.v]) { b.remove(); return; } b.addEventListener("click", () => { view = b.dataset.v; show(); }); });
    fig.querySelectorAll("[data-layer]").forEach((b) => b.addEventListener("click", () => { layer = b.dataset.layer; slots = new Map(); pinned = null; draw(); show(); }));
    let frameReq = 0;
    range.addEventListener("input", () => { if (timer) stop(); pinned = null; if (!frameReq) frameReq = requestAnimationFrame(() => { frameReq = 0; draw(); }); });
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = S.play; };
    playBtn.addEventListener("click", () => {
      if (timer) return stop();
      if (Number(range.value) >= C.STEPS) range.value = 0;
      playBtn.textContent = S.pause;
      pinned = null;
      timer = setInterval(() => { range.value = Math.min(C.STEPS, Number(range.value) + 5); draw(); if (Number(range.value) >= C.STEPS) stop(); }, 120);
    });
    draw(); show();
  }).catch((e) => { console.error("palaeo map:", e); fig.remove(); });
})();
