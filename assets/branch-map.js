(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GeoSmooth = factory();
})(this, function () {
  "use strict";

  const MIN_AROUND = 3;
  const key = (lat, lon) => lat + "," + lon;
  const wrapLon = (o) => ((((o + 180) % 360) + 360) % 360) - 180;
  const km = (a1, o1, a2, o2) => {
    const r = Math.PI / 180, h = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  // a branch's share within R: carriers over all members around each cell, both under a quartic kernel
  function smooth(branch, totals, step, R, minAround = MIN_AROUND) {
    const tot = new Map(totals.map((c) => [key(c[0], c[1]), c[2]]));
    const carriers = new Map(branch.map((p) => [key(p.lat, p.lon), p.share * (tot.get(key(p.lat, p.lon)) || 0)]));
    const dLat = Math.ceil(R / 111 / step) * step, out = [];
    for (const [lat, lon] of totals) {
      const cLat = lat + step / 2, cLon = lon + step / 2;
      const dLon = Math.min(179, Math.ceil(R / (111 * Math.max(0.1, Math.cos((cLat * Math.PI) / 180))) / step) * step);
      let num = 0, den = 0;
      for (let a = lat - dLat; a <= lat + dLat; a += step) for (let o = lon - dLon; o <= lon + dLon; o += step) {
        const k = key(a, wrapLon(o)), t = tot.get(k);
        if (!t) continue;
        const d = km(cLat, cLon, a + step / 2, o + step / 2);
        if (d >= R) continue;
        const w = (1 - (d / R) ** 2) ** 2;
        den += w * t;
        num += w * (carriers.get(k) || 0);
      }
      if (num > 0 && den >= minAround) out.push({ lat, lon, share: num / den });
    }
    return out;
  }

  return { smooth, km, MIN_AROUND };
});
// Time slider logic of the palaeo map, shared by the page script and the tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PaleoMapCore = factory();
})(this, function () {
  "use strict";

  const STEPS = 1000;
  const AGO_MIN = 150;
  const AGO_MAX = 14000;
  const MIN_HALF = 150;
  // the further back, the fewer samples: the window widens with age
  const HALF_SHARE = 0.12;
  const SLOTS = 8;

  // slider 0 = oldest, STEPS = most recent; log scale, so the last millennia get most of the track
  const agoOf = (v) => Math.round(Math.exp(Math.log(AGO_MAX) + (Math.log(AGO_MIN) - Math.log(AGO_MAX)) * (v / STEPS)));
  const sliderOf = (ago) => Math.round(((Math.log(AGO_MAX) - Math.log(Math.min(AGO_MAX, Math.max(AGO_MIN, ago)))) / (Math.log(AGO_MAX) - Math.log(AGO_MIN))) * STEPS);
  const halfWidth = (ago) => Math.max(MIN_HALF, Math.round((ago * HALF_SHARE) / 50) * 50);

  // a Y point carries [lat, lon, year, oldest, youngest, ..]: its dating range touching the window counts; mt has one date
  const covers = (kind, p, year, half) => (kind === "y" ? p[3] <= year + half && p[4] >= year - half : p[2] >= year - half && p[2] <= year + half);

  function groups(points, keyOf) {
    const m = new Map();
    for (const p of points) { const k = keyOf(p); if (k == null || k < 0) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    return [...m].map(([key, pts]) => ({ key, pts })).sort((a, b) => b.pts.length - a.pts.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  // colour slots 1..SLOTS for the largest groups; a group keeps its slot while it stays among them, so colours do not jump
  function assignSlots(prev, keys, n = SLOTS) {
    const top = keys.slice(0, n), out = new Map(), used = new Set();
    for (const k of top) if (prev.has(k)) { out.set(k, prev.get(k)); used.add(prev.get(k)); }
    let free = 1;
    for (const k of top) if (!out.has(k)) { while (used.has(free)) free++; out.set(k, free); used.add(free); }
    return out;
  }

  // Discover's area holds from its year until the next frame
  function frameAt(frames, year) {
    let best = null;
    for (const f of frames || []) { if (f[0] > year) break; best = f; }
    return best;
  }

  return { frameAt, STEPS, AGO_MIN, AGO_MAX, SLOTS, agoOf, sliderOf, halfWidth, covers, groups, assignSlots };
});
// The branch map: one layer at a time — the branch's share of each country's kits, or the geographic project members
// at their ancestors' places (share or head count, 1° discs blurred and clipped to land) with the 68 % circle.
(function () {
  "use strict";
  const fig = document.getElementById("bmap");
  const blobEl = document.getElementById("bmap-data");
  if (!fig || !blobEl) return;
  const D = JSON.parse(blobEl.textContent);
  const lang = D.lang;
  const frame = fig.querySelector(".cmap-frame"), cap = fig.querySelector(".cmap-cap"), legend = fig.querySelector(".bmap-legend"), note = fig.querySelector(".bmap-note"), metrics = fig.querySelector(".bmap-metrics");
  const NS = "http://www.w3.org/2000/svg";
  const SPECIAL = { "x-ru-ua": "mapRuUa", "x-ose": "mapOse" };
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const nf = (x) => x.toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const pf = (x) => { const s = (100 * x).toFixed(x < 0.1 ? 1 : 0); return (lang === "ru" ? s.replace(".", ",") : s) + "%"; };
  const deg = (v, pos, neg) => { const s = Math.abs(v).toFixed(1); return (lang === "ru" ? s.replace(".", ",") : s) + "° " + (v >= 0 ? pos : neg); };
  const COUNT_EDGES = [4, 9, 19, 49];
  const shareEdges = (max) => [1, 2, 3, 4].map((i) => max * (i / 5) ** 2);
  const binOf = (v, edges) => { const i = edges.findIndex((e) => v <= e + 1e-9); return i < 0 ? edges.length + 1 : i + 1; };
  const swatch = (cls, text) => { const s = document.createElement("span"), i = document.createElement("i"); i.className = cls; s.appendChild(i); s.appendChild(document.createTextNode(text)); legend.appendChild(s); };

  // value "rate": kits per 100,000, edges by quantile from the build; otherwise shares in basis points
  const rate = D.value === "rate";
  const rf1 = (x) => (x >= 99.95 ? nf(Math.round(x)) : lang === "ru" ? x.toFixed(1).replace(".", ",") : x.toFixed(1));
  const rf = (x) => (x < 0.05 ? "< " + rf1(0.1) : rf1(x));
  const vf = rate ? (x) => rf1(Math.max(0.1, x)) : pf;
  const shares = new Map(Object.entries(D.shares || {}).map(([k, v]) => [k, rate ? v : v / 1e4]));

  const near = new Promise((resolve) => {
    if (!("IntersectionObserver" in window)) return resolve();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); resolve(); } }, { rootMargin: "300px 0px" });
    io.observe(fig);
  });
  near.then(() => Promise.all([
    (window.ftdMapWorld = window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json())),
    fetch("/data/map-base.json").then((r) => r.json()),
    // the country layer stands without the geo one: a missing file or projection script only drops the ancestors' layers
    D.geo && window.EqEarth ? fetch(D.geo.src).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
  ])).then(([geo, base, G]) => {
    const S = Object.assign({}, base.i18n[lang], D.s);
    const counted = new Set(base[D.kind]);
    const nameOf = (id) => (base.names[id] ? base.names[id][lang === "ru" ? 0 : 1] : null);
    const classOf = (id) => (shares.has(id) ? "m" + binOf(shares.get(id), D.edges) : counted.has(id) && !rate ? "m0" : base.names[id] ? "msm" : "mna");

    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.getAttribute("aria-label") });
    const defs = el("defs", {});
    // 5 px stripes at any zoom: fitHatch() rescales the pattern from screen pixels to map units
    const pat = el("pattern", { id: "cmap-hatch", width: "5", height: "5", patternUnits: "userSpaceOnUse" });
    pat.appendChild(el("rect", { width: "5", height: "5", class: "cmap-hatch-bg" }));
    pat.appendChild(el("line", { x1: "0", y1: "0", x2: "0", y2: "5", class: "cmap-hatch-ln" }));
    defs.appendChild(pat);
    svg.appendChild(defs);

    const countries = el("g", {}), paths = new Map();
    for (const u of geo.units) {
      const p = el("path", { d: u.d, class: "u " + classOf(u.id), "data-id": u.id });
      paths.set(u.id, p);
      countries.appendChild(p);
    }
    svg.appendChild(countries);

    const people = el("g", {});
    let pts = [], steps = [], ringBox = null, centerDot = null, place = null;
    if (G) {
      const P = (lon, lat) => EqEarth.toMap(geo.proj, lon, lat), half = G.cell / 2;
      const landD = geo.units.map((u) => u.d).join("");
      const clip = el("clipPath", { id: "bmap-land" });
      clip.appendChild(el("path", { d: landD }));
      defs.appendChild(clip);
      const blur = el("filter", { id: "bmap-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" });
      const gauss = el("feGaussianBlur", { stdDeviation: "1" });
      blur.appendChild(gauss);
      defs.appendChild(blur);
      people.appendChild(el("path", { d: landD, class: "gm-land" }));
      const heatClip = el("g", { "clip-path": "url(#bmap-land)" }), heat = el("g", { filter: "url(#bmap-blur)", class: "gm-heat" });
      heatClip.appendChild(heat);
      people.appendChild(heatClip);
      // radius from the cell's height: a width would jump across the projection's seam at lon −169
      place = (lat, lon) => { const [x, y] = P(lon + half, lat + half), [, y2] = P(lon + half, lat + 2 * half); return { x, y, r: Math.abs(y2 - y) * 1.6 }; };
      pts = G.cells.map(([lat, lon, n, share, home]) => Object.assign({ lat, lon, n, share: share / 1000, home }, place(lat, lon)));
      if (pts.length) gauss.setAttribute("stdDeviation", (pts.reduce((a, p) => a + p.r, 0) / pts.length * 0.5).toFixed(3));
      // one path per colour step, appended low to high: overlapping translucent discs would show the grid
      steps = [1, 2, 3, 4, 5].map((b) => { const s = el("path", { class: "g" + b }); heat.appendChild(s); return s; });
      if (G.center) {
        const ring = EqEarth.circle(G.center[0], G.center[1], G.r68).map(([lo, la]) => P(lo, la));
        // a ring crossing the map's edge would jump from one side to the other: break the path there
        let d = "", prev = null;
        for (const [x, y] of ring) { d += (prev && Math.abs(x - prev[0]) > geo.w / 3 ? "M" : d ? "L" : "M") + x.toFixed(2) + "," + y.toFixed(2); prev = [x, y]; }
        people.appendChild(el("path", { d, class: "gm-r68" }));
        if (!d.slice(1).includes("M")) { const xs = ring.map((r) => r[0]), ys = ring.map((r) => r[1]); ringBox = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; }
        const [cx, cy] = P(G.center[1], G.center[0]);
        centerDot = el("circle", { cx: cx.toFixed(2), cy: cy.toFixed(2), r: "3", class: "gm-center" });
        people.appendChild(centerDot);
      }
    }
    svg.appendChild(people);
    const ancLand = D.paleo ? el("path", { d: geo.units.map((u) => u.d).join(""), class: "gm-land" }) : el("g", {});
    svg.appendChild(ancLand);
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    const anc = el("g", { class: "bmap-anc" }), ancOff = el("path", { class: "anc-off" }), ancOn = el("path", { class: "anc-on" });
    anc.appendChild(ancOff);
    anc.appendChild(ancOn);
    svg.appendChild(anc);
    const outline = el("path", { class: "ring" });
    svg.appendChild(outline);
    frame.appendChild(svg);

    const geoLayers = (D.geo && D.geo.layers) || ["share", "count"];
    const PC = window.PaleoMapCore, timeRow = fig.querySelector(".bmap-time");
    const layers = [shares.size && "countries", pts.length && geoLayers.includes("share") && "share", pts.length && geoLayers.includes("count") && "count", D.paleo && PC && window.EqEarth && timeRow && "ancient"].filter(Boolean);
    if (!layers.length) { fig.remove(); return; }
    fig.querySelectorAll("[data-layer]").forEach((b) => { if (!layers.includes(b.dataset.layer)) b.remove(); });
    if (layers.length < 2) { const g = fig.querySelector(".bmap-layers"); if (g) g.remove(); }
    const geoAnchors = (fig.dataset.geoAnchors || "").split(" ");
    const hashLayer = () => { let h; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { return null; } return h && geoAnchors.includes(h) && layers.includes("share") ? "share" : null; };
    let layer = hashLayer() || layers[0], pinned = null;
    if (hashLayer() && !document.getElementById(decodeURIComponent(location.hash.slice(1)))) fig.scrollIntoView();
    const isGeo = () => layer !== "countries";
    const isPeople = () => layer === "share" || layer === "count";

    const tune = window.GeoSmooth && fig.querySelector(".bmap-tune"), gainEl = tune && tune.querySelector("input");
    let radius = 0, gain = 1, total = null, totalReq = null, cur = pts;
    const smoothed = new Map();
    // cells under MIN_CELL carriers are not in the branch file, so they count only in the denominator
    const smooth = (R) => {
      if (!smoothed.has(R)) smoothed.set(R, GeoSmooth.smooth(pts, total.cells, G.cell, R).map((c) => Object.assign(c, { smooth: true }, place(c.lat, c.lon))));
      return smoothed.get(R);
    };
    const setRadius = (r) => {
      radius = r;
      if (tune) tune.querySelectorAll("[data-r]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.r) === r)));
      pinned = null; last = undefined; paint(); describe(null);
    };
    if (fig.querySelector(".bmap-tune") && !tune) fig.querySelector(".bmap-tune").remove();
    if (tune) {
      tune.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => {
        const r = Number(b.dataset.r);
        // the last pressed radius wins, whatever order the clicks and the totals' arrival came in
        tune.dataset.want = r;
        if (!r || total) return setRadius(r);
        if (!totalReq) totalReq = fetch(D.geo.total).then((x) => x.json()).then((T) => { total = T; setRadius(Number(tune.dataset.want)); }).catch((e) => { totalReq = null; console.error("branch map totals:", e); });
      }));
      gainEl.addEventListener("input", () => { gain = Number(gainEl.value); gainEl.setAttribute("aria-valuetext", "×" + gain); paint(); });
    }

    // the time layer: samples in the slider's window, a patch per 1° cell at its samples' mean, the rest as grey dots
    const ancNote = fig.querySelector(".bmap-anc-note");
    const timeEl = timeRow && timeRow.querySelector("input"), timeOut = timeRow && timeRow.querySelector("output"), playBtn = timeRow && timeRow.querySelector("[data-play]");
    let ancPts = null, ancReq = null, ancShown = [], timer = null;
    if (timeRow && !layers.includes("ancient")) timeRow.remove();
    const yearText = (y) => { const r = Math.abs(y) >= 1000 ? Math.round(y / 50) * 50 : Math.round(y / 10) * 10; return r < 0 ? fmt(S.bce, { y: nf(-r) }) : fmt(S.ce, { y: nf(r) }); };
    const ancPlace = (lat, lon) => { const [x, y] = EqEarth.toMap(geo.proj, lon, lat), [, y2] = EqEarth.toMap(geo.proj, lon, lat + 0.7); return { x, y, r: Math.abs(y2 - y) }; };
    const loadAncient = () => {
      if (ancReq) return;
      ancReq = fetch(D.paleo.src).then((r) => r.json()).then((A) => {
        ancPts = A.map((p) => Object.assign({ p }, ancPlace(p[0], p[1])));
        views.ancient = fitBox(ancPts.map((q) => ({ x: q.x, y: q.y, n: 1 })), null);
        if (layer === "ancient") { if (!picked) view = "fit"; paint(); describe(null); show(); }
      }).catch((e) => { ancReq = null; console.error("branch map ancient:", e); });
    };
    function drawAncient() {
      if (!ancPts) { loadAncient(); ancShown = []; return; }
      const ago = PC.agoOf(Number(timeEl.value)), year = D.paleo.present - ago, half = PC.halfWidth(ago);
      const cells = new Map(), off = [];
      let n = 0;
      for (const q of ancPts) {
        if (!PC.covers(D.kind, q.p, year, half)) { off.push(disc({ x: q.x, y: q.y, r: q.r * 0.45 })); continue; }
        n++;
        const k = Math.floor(q.p[0]) + "," + Math.floor(q.p[1]);
        const c = cells.get(k) || cells.set(k, { lat: 0, lon: 0, n: 0 }).get(k);
        c.lat += q.p[0]; c.lon += q.p[1]; c.n++;
      }
      ancShown = [...cells.values()].map((c) => { const lat = c.lat / c.n, lon = c.lon / c.n, at = ancPlace(lat, lon); return { lat, lon, n: c.n, x: at.x, y: at.y, r: at.r * Math.min(2, 0.8 + 0.2 * Math.sqrt(c.n)) }; });
      ancOff.setAttribute("d", off.join(""));
      ancOn.setAttribute("d", ancShown.map(disc).join(""));
      const ep = (S.epochs || []).find((e) => e[0] == null || year < e[0]);
      timeOut.textContent = fmt(S.when, { year: yearText(year), half: nf(half) }) + (ep ? " · " + ep[1] : "") + " · " + fmt(S.count, { n: nf(n) });
      timeEl.setAttribute("aria-valuetext", timeOut.textContent);
    }
    const stopPlay = () => { if (timer) { clearInterval(timer); timer = null; playBtn.textContent = S.play; } };
    if (layers.includes("ancient")) {
      let frameReq = 0;
      timeEl.addEventListener("input", () => { stopPlay(); pinned = null; last = undefined; if (!frameReq) frameReq = requestAnimationFrame(() => { frameReq = 0; paint(); describe(null); }); });
      playBtn.addEventListener("click", () => {
        if (timer) return stopPlay();
        if (Number(timeEl.value) >= PC.STEPS) timeEl.value = 0;
        playBtn.textContent = S.pause;
        pinned = null;
        timer = setInterval(() => { timeEl.value = Math.min(PC.STEPS, Number(timeEl.value) + 5); pinned = null; last = undefined; paint(); describe(null); if (Number(timeEl.value) >= PC.STEPS) stopPlay(); }, 120);
      });
    }

    const disc = (p) => "M" + (p.x - p.r).toFixed(2) + "," + p.y.toFixed(2) + "a" + p.r.toFixed(2) + "," + p.r.toFixed(2) + " 0 1,0 " + (2 * p.r).toFixed(2) + ",0a" + p.r.toFixed(2) + "," + p.r.toFixed(2) + " 0 1,0 " + (-2 * p.r).toFixed(2) + ",0";
    function paint() {
      countries.style.display = isGeo() ? "none" : "";
      people.style.display = isPeople() ? "" : "none";
      anc.style.display = ancLand.style.display = layer === "ancient" ? "" : "none";
      svg.classList.toggle("geo", isGeo());
      if (note) note.hidden = !isPeople();
      if (metrics) metrics.hidden = !isPeople();
      if (tune) tune.hidden = layer !== "share";
      if (timeRow) timeRow.hidden = layer !== "ancient";
      if (ancNote) ancNote.hidden = layer !== "ancient";
      if (layer !== "ancient") stopPlay();
      legend.textContent = "";
      if (layer === "ancient") {
        drawAncient();
        cur = ancShown;
        swatch("gm-sw anc-sw-on", S.ancNow);
        swatch("gm-sw anc-sw-off", S.ancOther);
        return;
      }
      if (!isGeo()) {
        if (!rate) swatch("cmap-sw m0", "0");
        D.edges.forEach((v, i) => swatch("cmap-sw m" + (i + 1), (i === D.edges.length - 1 && rate ? "> " + vf(D.edges[i - 1]) : "≤ " + vf(v))));
        swatch("cmap-sw msm", S.small);
        return;
      }
      const share = layer === "share";
      cur = share && radius && total ? smooth(radius) : pts;
      const edges = share ? shareEdges(Math.max(...cur.map((p) => p.share)) / gain) : COUNT_EDGES;
      const ds = [[], [], [], [], []];
      for (const p of cur) ds[binOf(share ? p.share : p.n, edges) - 1].push(disc(p));
      steps.forEach((s, i) => s.setAttribute("d", ds[i].join("")));
      (share ? edges.map((e) => "≤ " + pf(e)).concat("> " + pf(edges[edges.length - 1])) : ["3–4", "5–9", "10–19", "20–49", "50+"]).forEach((t, i) => swatch("gm-sw g" + (i + 1), t));
      if (G.center) swatch("gm-sw-ring", S.legendRing);
    }

    function describe(target) {
      cap.textContent = "";
      if (layer === "ancient") {
        if (target == null) { cap.textContent = ancPts && !ancShown.length ? S.none : S.ancHint; return; }
        const p = cur[target];
        cap.textContent = fmt(S.ancCell, { lat: deg(p.lat, S.n, S.s), lon: deg(p.lon, S.e, S.w), n: nf(p.n) });
        return;
      }
      if (isGeo()) {
        if (target == null) { cap.textContent = S.hint; return; }
        const p = cur[target], at = { lat: deg(p.lat + G.cell / 2, S.n, S.s), lon: deg(p.lon + G.cell / 2, S.e, S.w), share: pf(p.share) };
        cap.textContent = p.smooth ? fmt(S.cellSmooth, Object.assign(at, { km: nf(radius) })) : fmt(S.cell, Object.assign(at, { n: nf(p.n) }));
        return;
      }
      if (!target) { cap.textContent = S.mapHint; return; }
      if (SPECIAL[target]) { cap.textContent = S[SPECIAL[target]]; return; }
      const name = nameOf(target);
      if (!name) { cap.textContent = S.mapNoData; return; }
      const a = document.createElement("a");
      a.textContent = name;
      a.href = "/" + lang + "/c/" + target + "/";
      cap.appendChild(a);
      const msg = shares.has(target) ? (rate ? fmt(S.rate, { v: rf(shares.get(target)) }) : fmt(S.mapShare, { pct: pf(shares.get(target)) })) : rate ? S.small : counted.has(target) ? S.mapZero : fmt(S.mapSmall, { n: D.minN });
      cap.appendChild(document.createTextNode(": " + msg));
    }
    const mark = (id) => { if (id && paths.has(id)) outline.setAttribute("d", paths.get(id).getAttribute("d")); else outline.removeAttribute("d"); };
    // the disc under the pointer: the nearest centre within its radius, in map units; a finger misses a 4 px disc,
    // so a touch also accepts the nearest centre within `reach` CSS px (m.a is CSS px per map unit)
    const discAt = (ev, reach = 0) => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const q = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      const nearest = (extra) => { let best = null, bd = Infinity; cur.forEach((p, i) => { const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2, r = Math.max(p.r, extra); if (d < bd && d <= r * r) { bd = d; best = i; } }); return best; };
      const hit = nearest(0);
      return hit != null || !reach ? hit : nearest(reach / m.a);
    };
    const TAP_REACH = 12;
    let touch = false;
    svg.addEventListener("pointerdown", (ev) => { touch = ev.pointerType === "touch"; });
    const targetOf = (ev, reach) => (isGeo() ? discAt(ev, reach) : (ev.target.getAttribute && ev.target.getAttribute("data-id")) || null);
    let last;
    svg.addEventListener("pointermove", (ev) => {
      if (pinned != null || ev.pointerType === "touch") return;
      const x = targetOf(ev);
      if (x !== last) { last = x; if (!isGeo()) mark(x); describe(x); }
    });
    svg.addEventListener("pointerleave", (ev) => { if (pinned == null && ev.pointerType !== "touch") { last = undefined; mark(null); describe(null); } });
    svg.addEventListener("click", (ev) => {
      const x = targetOf(ev, touch ? TAP_REACH : 0);
      pinned = x != null && x !== pinned ? x : null;
      last = undefined;
      if (!isGeo()) mark(pinned);
      describe(pinned);
    });

    // the box of the middle 90 % of carriers on each axis, with the 68 % circle: a lone family far away does not zoom
    // the map out, and a branch with one painted cell does not zoom onto that cell alone
    const home = pts.some((p) => p.home) ? pts.filter((p) => p.home) : pts;
    const spanOf = (list, key) => {
      const s = list.slice().sort((a, b) => a[key] - b[key]), total = s.reduce((a, p) => a + p.n, 0);
      let acc = 0, lo = s[0][key], hi = s[s.length - 1][key];
      for (const p of s) { acc += p.n; if (acc >= 0.05 * total) { lo = p[key]; break; } }
      acc = 0;
      for (const p of s.slice().reverse()) { acc += p.n; if (acc >= 0.05 * total) { hi = p[key]; break; } }
      return [lo, hi];
    };
    function fitBox(list, rb) {
      let [x0, x1] = spanOf(list, "x"), [y0, y1] = spanOf(list, "y");
      if (rb) { x0 = Math.min(x0, rb[0]); x1 = Math.max(x1, rb[1]); y0 = Math.min(y0, rb[2]); y1 = Math.max(y1, rb[3]); }
      const pad = Math.max(8, (x1 - x0) * 0.08);
      x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
      const w = Math.min(geo.w, Math.max(x1 - x0, 2 * (y1 - y0), geo.w / 8)), h = w / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
      return [clamp(cx - w / 2, geo.w - w), clamp(cy - h / 2, geo.h - h), w, h];
    }
    const views = Object.assign({ world: [0, 0, geo.w, geo.h] }, geo.views);
    if (home.length) views.fit = fitBox(home, ringBox);
    // "fit" means the layer's own range: the ancestors' cells or, on the time layer, its samples
    // the part of the world the build picked for the branch: the country layer's "fit"
    const region = D.view && D.view !== "world" && views[D.view] ? views[D.view] : null;
    const boxOf = (v) => (v !== "fit" ? views[v] : layer === "ancient" ? views.ancient || views.fit || region || views.world : layer === "countries" ? region || views.fit || views.world : views.fit || region || views.ancient || views.world);
    // every layer opens on its own range until the reader picks a view
    const autoView = () => (layer === "ancient" && views.ancient ? "fit" : layer !== "countries" && layer !== "ancient" && views.fit ? "fit" : layer === "countries" && region ? "fit" : "world");
    let view = autoView(), picked = false;
    function fitHatch() {
      const w = svg.clientWidth || geo.w, v = boxOf(view);
      pat.setAttribute("patternTransform", "rotate(45) scale(" + Math.max(v[2] / w, v[3] / (w / 2)).toFixed(4) + ")");
    }
    function show() {
      const v = boxOf(view);
      svg.setAttribute("viewBox", v.map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", view !== "world");
      if (centerDot) centerDot.setAttribute("r", (v[2] / 200).toFixed(2));
      fig.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
      fig.querySelectorAll("[data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === layer)));
      fitHatch();
    }
    fig.querySelectorAll("[data-v]").forEach((b) => {
      if (!views[b.dataset.v] && !(b.dataset.v === "fit" && (region || layers.includes("ancient")))) { b.remove(); return; }
      b.addEventListener("click", () => { view = b.dataset.v; picked = true; show(); });
    });
    fig.querySelectorAll("[data-layer]").forEach((b) => b.addEventListener("click", () => { layer = b.dataset.layer; if (!picked) view = autoView(); pinned = null; last = undefined; mark(null); paint(); describe(null); show(); }));
    window.addEventListener("resize", fitHatch);
    window.addEventListener("hashchange", () => { const l = hashLayer(); if (l && l !== layer) fig.querySelector('[data-layer="' + l + '"]').click(); });
    paint(); describe(null); show();
  }).catch((e) => { console.error("branch map:", e); fig.remove(); });
})();
