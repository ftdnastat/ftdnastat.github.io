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

  const shares = new Map(Object.entries(D.shares || {}).map(([k, v]) => [k, v / 1e4]));
  const top = shares.size ? [...shares.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0] : null;

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
    const classOf = (id) => (shares.has(id) ? "m" + binOf(shares.get(id), D.edges) : counted.has(id) ? "m0" : base.names[id] ? "msm" : "mna");

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
    let pts = [], steps = [], ringBox = null, centerDot = null;
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
      pts = G.cells.map(([lat, lon, n, share, home]) => {
        const [x, y] = P(lon + half, lat + half), [, y2] = P(lon + half, lat + 2 * half);
        return { lat, lon, n, share: share / 1000, home, x, y, r: Math.abs(y2 - y) * 1.6 };
      });
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
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    const outline = el("path", { class: "ring" });
    svg.appendChild(outline);
    frame.appendChild(svg);

    const layers = [shares.size && "countries", pts.length && "share", pts.length && "count"].filter(Boolean);
    if (!layers.length) { fig.remove(); return; }
    fig.querySelectorAll("[data-layer]").forEach((b) => { if (!layers.includes(b.dataset.layer)) b.remove(); });
    if (layers.length < 2) { const g = fig.querySelector(".bmap-layers"); if (g) g.remove(); }
    const geoAnchors = (fig.dataset.geoAnchors || "").split(" ");
    const hashLayer = () => { let h = ""; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { return null; } return h && geoAnchors.includes(h) && layers.includes("share") ? "share" : null; };
    let layer = hashLayer() || layers[0], pinned = null;
    const isGeo = () => layer !== "countries";

    const disc = (p) => "M" + (p.x - p.r).toFixed(2) + "," + p.y.toFixed(2) + "a" + p.r.toFixed(2) + "," + p.r.toFixed(2) + " 0 1,0 " + (2 * p.r).toFixed(2) + ",0a" + p.r.toFixed(2) + "," + p.r.toFixed(2) + " 0 1,0 " + (-2 * p.r).toFixed(2) + ",0";
    function paint() {
      countries.style.display = isGeo() ? "none" : "";
      people.style.display = isGeo() ? "" : "none";
      svg.classList.toggle("geo", isGeo());
      if (note) note.hidden = !isGeo();
      if (metrics) metrics.hidden = !isGeo();
      legend.textContent = "";
      if (!isGeo()) {
        swatch("cmap-sw m0", "0");
        D.edges.forEach((v, i) => swatch("cmap-sw m" + (i + 1), "≤ " + pf(v)));
        swatch("cmap-sw msm", S.small);
        return;
      }
      const share = layer === "share", edges = share ? shareEdges(Math.max(...pts.map((p) => p.share))) : COUNT_EDGES;
      const ds = [[], [], [], [], []];
      for (const p of pts) ds[binOf(share ? p.share : p.n, edges) - 1].push(disc(p));
      steps.forEach((s, i) => s.setAttribute("d", ds[i].join("")));
      (share ? edges.map((e) => "≤ " + pf(e)).concat("> " + pf(edges[edges.length - 1])) : ["3–4", "5–9", "10–19", "20–49", "50+"]).forEach((t, i) => swatch("gm-sw g" + (i + 1), t));
      if (G.center) swatch("gm-sw-ring", S.legendRing);
    }

    function describe(target) {
      cap.textContent = "";
      if (isGeo()) {
        if (target == null) { cap.textContent = S.hint; return; }
        const p = pts[target];
        cap.textContent = fmt(S.cell, { lat: deg(p.lat + G.cell / 2, S.n, S.s), lon: deg(p.lon + G.cell / 2, S.e, S.w), n: nf(p.n), share: pf(p.share) });
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
      const msg = shares.has(target) ? fmt(S.mapShare, { pct: pf(shares.get(target)) }) : counted.has(target) ? S.mapZero : fmt(S.mapSmall, { n: D.minN });
      cap.appendChild(document.createTextNode(": " + msg));
    }
    const mark = (id) => { if (id && paths.has(id)) outline.setAttribute("d", paths.get(id).getAttribute("d")); else outline.removeAttribute("d"); };
    // the disc under the pointer: the nearest centre within its radius, in map units
    const discAt = (ev) => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const q = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      let best = null, bd = Infinity;
      pts.forEach((p, i) => { const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (d < bd && d <= p.r * p.r) { bd = d; best = i; } });
      return best;
    };
    const targetOf = (ev) => (isGeo() ? discAt(ev) : (ev.target.getAttribute && ev.target.getAttribute("data-id")) || null);
    let last;
    svg.addEventListener("pointermove", (ev) => {
      if (pinned != null || ev.pointerType === "touch") return;
      const x = targetOf(ev);
      if (x !== last) { last = x; if (!isGeo()) mark(x); describe(x); }
    });
    svg.addEventListener("pointerleave", (ev) => { if (pinned == null && ev.pointerType !== "touch") { last = undefined; mark(null); describe(null); } });
    svg.addEventListener("click", (ev) => {
      const x = targetOf(ev);
      pinned = x != null && x !== pinned ? x : null;
      last = undefined;
      if (!isGeo()) mark(pinned);
      describe(pinned);
    });

    // the box of the middle 90 % of carriers on each axis, with the 68 % circle: a lone family far away does not zoom
    // the map out, and a branch with one painted cell does not zoom onto that cell alone
    const home = pts.some((p) => p.home) ? pts.filter((p) => p.home) : pts;
    const spanOf = (key) => {
      const s = home.slice().sort((a, b) => a[key] - b[key]), total = s.reduce((a, p) => a + p.n, 0);
      let acc = 0, lo = s[0][key], hi = s[s.length - 1][key];
      for (const p of s) { acc += p.n; if (acc >= 0.05 * total) { lo = p[key]; break; } }
      acc = 0;
      for (const p of s.slice().reverse()) { acc += p.n; if (acc >= 0.05 * total) { hi = p[key]; break; } }
      return [lo, hi];
    };
    function fitBox() {
      let [x0, x1] = spanOf("x"), [y0, y1] = spanOf("y");
      if (ringBox) { x0 = Math.min(x0, ringBox[0]); x1 = Math.max(x1, ringBox[1]); y0 = Math.min(y0, ringBox[2]); y1 = Math.max(y1, ringBox[3]); }
      const pad = Math.max(8, (x1 - x0) * 0.08);
      x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
      const w = Math.min(geo.w, Math.max(x1 - x0, 2 * (y1 - y0), geo.w / 8)), h = w / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
      return [clamp(cx - w / 2, geo.w - w), clamp(cy - h / 2, geo.h - h), w, h];
    }
    const views = Object.assign({ world: [0, 0, geo.w, geo.h] }, geo.views);
    if (home.length) views.fit = fitBox();
    const box = top && paths.has(top) ? paths.get(top).getBBox() : null;
    const inside = (v) => box && box.x >= v[0] && box.y >= v[1] && box.x + box.width <= v[0] + v[2] && box.y + box.height <= v[1] + v[3];
    // the country layer opens on its top country's region, the ancestors' layers on their fit, until the reader picks a view
    const countryView = ["caucasus", "europe"].find((k) => views[k] && inside(views[k])) || "world";
    const autoView = () => (layer !== "countries" && views.fit ? "fit" : countryView);
    let view = autoView(), picked = false;
    function fitHatch() {
      const w = svg.clientWidth || geo.w, v = views[view];
      pat.setAttribute("patternTransform", "rotate(45) scale(" + Math.max(v[2] / w, v[3] / (w / 2)).toFixed(4) + ")");
    }
    function show() {
      const v = views[view];
      svg.setAttribute("viewBox", v.map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", view !== "world");
      if (centerDot) centerDot.setAttribute("r", (v[2] / 200).toFixed(2));
      fig.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
      fig.querySelectorAll("[data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === layer)));
      fitHatch();
    }
    fig.querySelectorAll("[data-v]").forEach((b) => {
      if (!views[b.dataset.v]) { b.remove(); return; }
      b.addEventListener("click", () => { view = b.dataset.v; picked = true; show(); });
    });
    fig.querySelectorAll("[data-layer]").forEach((b) => b.addEventListener("click", () => { layer = b.dataset.layer; if (!picked) view = autoView(); pinned = null; last = undefined; mark(null); paint(); describe(null); show(); }));
    window.addEventListener("resize", fitHatch);
    window.addEventListener("hashchange", () => { const l = hashLayer(); if (l && l !== layer) fig.querySelector('[data-layer="' + l + '"]').click(); });
    paint(); describe(null); show();
  }).catch((e) => { console.error("branch map:", e); fig.remove(); });
})();
